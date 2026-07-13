import { composePromptBlocks, loadStepPrompt } from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep } from "@/lib/config/models";
import { clearIntentAgentSession, loadIntentAgentSession, saveIntentAgentSession } from "./sessionStore";
import { buildIntentAgentControlTools, PIPELINE_CONSTRAINTS_TEXT } from "./tools";
import { mergeIntentAgentTools, INTENT_AGENT_RESERVED_TOOL_NAMES } from "./toolSurface";
import { classifyBriefSubstanceForCommit } from "./briefSubstanceClassifier";
import { resolveCommitMergedBrief } from "./commitMergeBrief";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ToolResult } from "@/ai/tools/types";
import type {
  IntentAgentTurnResult,
  IntentAgentToolExtensions,
  IntentAgentYieldKind,
  IntentAgentYieldPayload,
  IntentProgressEvent,
} from "./types";
import { collectIntentAgentImageSourceTexts } from "./collectImageSourceTexts";
import { buildUserVisionContent, userTurnPlainTextForClassifier } from "../shared/userVisionContent";
import type { IntentAgentTraceStep } from "./types";

function truncatePreview(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function serializeArgsPreview(args: Record<string, unknown>): string {
  try {
    return truncatePreview(JSON.stringify(args), 1500);
  } catch {
    return "{}";
  }
}

function serializeResultPreview(result: ToolResult | string): string {
  if (typeof result === "string") return truncatePreview(result, 2800);
  if (result.success && typeof result.output === "string") {
    return truncatePreview(result.output, 2800);
  }
  if (!result.success && result.error) return truncatePreview(result.error, 2800);
  try {
    return truncatePreview(JSON.stringify(result), 2800);
  } catch {
    return "[result]";
  }
}

function isYieldKind(k: unknown): k is IntentAgentYieldKind {
  return k === "capability" || k === "clarify" || k === "options" || k === "confirm_brief";
}

/** Exported for tests */
export function parseYieldArgs(args: Record<string, unknown>): IntentAgentYieldPayload {
  const kind: IntentAgentYieldKind = isYieldKind(args.kind) ? args.kind : "clarify";
  const message =
    typeof args.message === "string" && args.message.trim()
      ? args.message.trim()
      : "请用一句话说明你希望做单页网站的**目标**与**主要内容**（面向谁、要展示/操作什么）。";
  const suggestedReplies = Array.isArray(args.suggested_replies)
    ? args.suggested_replies
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  // Legacy `options` ignored — UI only shows suggestedReplies (max 3).
  const briefDraftMarkdown =
    typeof args.brief_draft_markdown === "string" && args.brief_draft_markdown.trim()
      ? args.brief_draft_markdown.trim()
      : undefined;
  return { kind, message, suggestedReplies, options: [], briefDraftMarkdown };
}

const DEFAULT_FORCE_YIELD_MESSAGE =
  "先把方向定清楚再生成会更稳。请用一两句话说明：这个单页主要给谁用、在首页上要完成什么、以及你希望的大致视觉气质。";

export interface RunIntentAgentTurnParams {
  projectId: string;
  userMessage: string;
  /**
   * First prompt stored on `POST /api/projects` (hero flow). Used when intent `commit_generate`
   * omits substantive `merged_brief` — do not substitute the trailing「就这样」「开始生成吧」alone.
   */
  bootstrapUserPrompt?: string | null;
  /** When true, drop persisted session and start fresh (system + this user message). */
  resetSession?: boolean;
  onMessage?: (msg: ChatMessage) => void;
  /**
   * Extra tool schemas / handlers merged at runtime — never shadows `yield_to_user` / `commit_generate`.
   */
  toolExtensions?: IntentAgentToolExtensions;
  /** Pasted screenshot (data URL or base64) for this turn — sent as vision alongside `userMessage`. */
  userImageBase64?: string | null;
  /**
   * Streamed while the intent tool loop runs: assistant rounds, optional model reasoning
   * text, and each completed tool (name + truncated args/result).
   */
  onIntentProgress?: (event: IntentProgressEvent) => void;
}

/**
 * One user turn: append message, run tool loop until yield/commit or plain assistant text.
 * Persists OpenAI-shaped history under `.open-ox/intent-agent/{projectId}/intent-agent-session.json`.
 */
export async function runIntentAgentTurn(params: RunIntentAgentTurnParams): Promise<IntentAgentTurnResult> {
  const {
    projectId,
    userMessage,
    bootstrapUserPrompt,
    resetSession,
    onMessage,
    toolExtensions,
    onIntentProgress,
    userImageBase64,
  } = params;
  const hasUserImage = Boolean(userImageBase64?.trim());
  const tailPlainForCommit = userTurnPlainTextForClassifier(userMessage, hasUserImage);
  const model = getModelForStep("intent_agent");

  const systemPrompt = composePromptBlocks([
    loadStepPrompt("projectIntentAgent"),
    PIPELINE_CONSTRAINTS_TEXT,
  ]);

  const persisted = resetSession ? null : await loadIntentAgentSession(projectId);
  const messages: ChatMessage[] = persisted?.messages?.length
    ? persisted.messages.map((m) => ({ ...m }))
    : [{ role: "system", content: systemPrompt }];

  if (messages[0]?.role !== "system") {
    messages.unshift({ role: "system", content: systemPrompt });
  } else {
    messages[0] = { role: "system", content: systemPrompt };
  }

  messages.push({
    role: "user",
    content: buildUserVisionContent(userMessage, userImageBase64 ?? null),
  });

  const baseTools = buildIntentAgentControlTools();
  const tools = mergeIntentAgentTools({
    base: baseTools,
    extensions: toolExtensions?.tools,
  });
  const maxIterations = 2;
  const trace: IntentAgentTraceStep[] = [];
  let llmRoundCount = 0;
  const turnCounter = (persisted?.turnCounter ?? 0) + 1;
  const toolCalls: AgentToolCallRecord[] = [];

  type TurnResolution =
    | { type: "yield"; payload: IntentAgentYieldPayload }
    | { type: "commit"; mergedBrief: string; imageSourceTexts: string[] };

  const box: { resolution: TurnResolution | null } = { resolution: null };
  let activeToolIteration = 0;
  let forceYieldNextRound = false;

  const wrapTimedTool = (
    name: string,
    fn: (args: Record<string, unknown>) => Promise<ToolResult | string>
  ) => {
    return async (args: Record<string, unknown>) => {
      const t0 = Date.now();
      const result = await fn(args);
      trace.push({
        kind: "tool",
        iteration: activeToolIteration,
        toolName: name,
        durationMs: Date.now() - t0,
        argsPreview: serializeArgsPreview(args).slice(0, 200),
      });
      return result;
    };
  };

  const executeToolOverrides: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  > = {
    yield_to_user: wrapTimedTool("yield_to_user", async (args: Record<string, unknown>) => {
      box.resolution = { type: "yield", payload: parseYieldArgs(args) };
      return JSON.stringify({ ok: true, halted: true, action: "yield_to_user" });
    }),
    commit_generate: wrapTimedTool("commit_generate", async (args: Record<string, unknown>) => {
      const raw = typeof args.merged_brief === "string" ? args.merged_brief.trim() : "";
      const substance = await classifyBriefSubstanceForCommit({
        mergedBriefRaw: raw,
        tailUserMessage: tailPlainForCommit,
        bootstrapUserPrompt: bootstrapUserPrompt ?? "",
      });
      box.resolution = {
        type: "commit",
        mergedBrief: resolveCommitMergedBrief({
          mergedBriefRaw: raw,
          messages,
          tailUserMessage: tailPlainForCommit,
          bootstrapUserPrompt,
          substance,
        }).trim(),
        imageSourceTexts: collectIntentAgentImageSourceTexts({
          bootstrapUserPrompt,
          messages,
        }),
      };
      return JSON.stringify({ ok: true, halted: true, action: "commit_generate" });
    }),
  };

  for (const [name, fn] of Object.entries(toolExtensions?.toolHandlers ?? {})) {
    if (INTENT_AGENT_RESERVED_TOOL_NAMES.has(name)) continue;
    executeToolOverrides[name] = fn;
  }

  const yieldOnlyTools = baseTools.filter(
    (t) => t.type === "function" && t.function.name === "yield_to_user"
  );

  const { content, toolCalls: calls } = await callLLMWithToolsFromMessages({
    messages,
    tools,
    temperature: 0.35,
    maxIterations,
    model,
    executeToolOverrides,
    onMessage,
    shouldAbortAfterToolResults: () => box.resolution !== null,
    langfusePhase: LfToolPhase.intentAgent,
    resolveToolsForIteration: (iteration, defaultTools) => {
      if (box.resolution === null && (forceYieldNextRound || iteration >= 1)) {
        return yieldOnlyTools.length > 0 ? yieldOnlyTools : defaultTools;
      }
      return defaultTools;
    },
    resolveToolChoiceForIteration: (iteration) => {
      if (box.resolution === null && (forceYieldNextRound || iteration >= 1)) {
        return "required";
      }
      return "auto";
    },
    onApproachingLimit: ({ messages: msgs }) => {
      msgs.push({
        role: "system",
        content:
          "【系统】本轮必须立刻调用 `yield_to_user` 结束（澄清、选项或确认草稿）。禁止空转。",
      });
      forceYieldNextRound = true;
    },
    onReasoning: onIntentProgress
      ? ({ iteration, text }) => {
          onIntentProgress({
            kind: "reasoning",
            iteration,
            text: truncatePreview(text, 12_000),
          });
        }
      : undefined,
    onAssistantRound: ({ iteration, textPreview, toolCallNames }) => {
      activeToolIteration = iteration;
      llmRoundCount += 1;
      const hasControl =
        toolCallNames.includes("yield_to_user") || toolCallNames.includes("commit_generate");
      if (!hasControl && box.resolution === null) {
        forceYieldNextRound = true;
      }
      trace.push({
        kind: "llm_round",
        iteration,
        toolCallNames,
        textPreview: textPreview ? truncatePreview(textPreview, 400) : null,
      });
      onIntentProgress?.({
        kind: "assistant_round",
        iteration,
        textPreview,
        toolCallNames,
      });
    },
    onToolCall: onIntentProgress
      ? ({ name, args, iteration, result }) => {
          onIntentProgress({
            kind: "tool",
            iteration,
            toolName: name,
            argsPreview: serializeArgsPreview(args),
            resultPreview: serializeResultPreview(result),
          });
        }
      : undefined,
  });

  for (const c of calls) {
    toolCalls.push(c);
  }

  const resolution = box.resolution;
  const turnMeta = {
    trace: [...trace],
    llmRoundCount,
  };

  if (resolution?.type === "yield") {
    await saveIntentAgentSession({
      version: 1,
      projectId,
      updatedAt: new Date().toISOString(),
      turnCounter,
      messages,
    });
    return {
      status: "yield",
      yieldPayload: resolution.payload,
      turnCounter,
      toolCalls,
      ...turnMeta,
    };
  }

  if (resolution?.type === "commit") {
    const merged = resolution.mergedBrief.trim();
    if (!merged) {
      await saveIntentAgentSession({
        version: 1,
        projectId,
        updatedAt: new Date().toISOString(),
        turnCounter,
        messages,
      });
      return {
        status: "error",
        errorMessage: "commit_generate invoked with empty merged_brief.",
        turnCounter,
        toolCalls,
        ...turnMeta,
      };
    }

    await clearIntentAgentSession(projectId);
    return {
      status: "commit_generate",
      mergedBrief: merged,
      imageSourceTexts: resolution.imageSourceTexts,
      turnCounter,
      toolCalls,
      ...turnMeta,
    };
  }

  await saveIntentAgentSession({
    version: 1,
    projectId,
    updatedAt: new Date().toISOString(),
    turnCounter,
    messages,
  });
  const text = content.trim() || DEFAULT_FORCE_YIELD_MESSAGE;
  return {
    status: content.trim() ? "implicit_yield" : "yield",
    assistantText: content.trim() || undefined,
    yieldPayload: {
      kind: "clarify",
      message: text,
      suggestedReplies: ["目标用户是……", "首页主要展示……", "视觉风格偏……"],
      options: [],
    },
    turnCounter,
    toolCalls,
    ...turnMeta,
  };
}
