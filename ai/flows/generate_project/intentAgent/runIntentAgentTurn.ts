import { composePromptBlocks, loadStepPrompt } from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep } from "@/lib/config/models";
import { clearIntentAgentSession, loadIntentAgentSession, saveIntentAgentSession } from "./sessionStore";
import { buildIntentAgentTools, PIPELINE_CONSTRAINTS_TEXT } from "./tools";
import { mergeIntentAgentTools, INTENT_AGENT_RESERVED_TOOL_NAMES } from "./toolSurface";
import { resolveCommitMergedBrief } from "./commitMergeBrief";
import { executeReferenceSiteDigest } from "@/ai/tools/system/referenceSiteDigestTool";
import { executeBrandKitFromUrl } from "@/ai/tools/system/brandKitFromUrlTool";
import { executeSinglePageIaProposal } from "@/ai/tools/system/singlePageIaProposalTool";
import { executeAccessibilitySeoBrief } from "@/ai/tools/system/accessibilitySeoBriefTool";
import { executeCompetitiveLandscapeSnapshot } from "@/ai/tools/system/competitiveLandscapeSnapshotTool";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ToolResult } from "@/ai/tools/types";
import type {
  IntentAgentOption,
  IntentAgentTurnResult,
  IntentAgentToolExtensions,
  IntentAgentYieldKind,
  IntentAgentYieldPayload,
  IntentProgressEvent,
} from "./types";

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
        .slice(0, 6)
    : [];
  const options: IntentAgentOption[] = [];
  if (Array.isArray(args.options)) {
    for (const o of args.options.slice(0, 6)) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const label = typeof r.label === "string" ? r.label.trim() : "";
      if (!id || !label) continue;
      const hint = typeof r.hint === "string" && r.hint.trim() ? r.hint.trim() : undefined;
      options.push({ id, label, ...(hint ? { hint } : {}) });
    }
  }
  const briefDraftMarkdown =
    typeof args.brief_draft_markdown === "string" && args.brief_draft_markdown.trim()
      ? args.brief_draft_markdown.trim()
      : undefined;
  return { kind, message, suggestedReplies, options, briefDraftMarkdown };
}

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
   * Tool calls without local handlers forward to global `executeSystemTool` when the name is registered project-wide.
   */
  toolExtensions?: IntentAgentToolExtensions;
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
  } = params;
  const model = getModelForStep("intent_agent");
  const systemPrompt = composePromptBlocks([loadStepPrompt("projectIntentAgent")]);
  const tools = mergeIntentAgentTools({
    base: buildIntentAgentTools(),
    extensions: toolExtensions?.tools,
  });

  const persisted = resetSession ? null : await loadIntentAgentSession(projectId);

  const messages: ChatMessage[] = persisted?.messages?.length
    ? persisted.messages.map((m) => ({ ...m }))
    : [{ role: "system", content: systemPrompt }];

  if (messages[0]?.role !== "system") {
    messages.unshift({ role: "system", content: systemPrompt });
  } else {
    messages[0] = { role: "system", content: systemPrompt };
  }

  messages.push({ role: "user", content: userMessage.trim() });

  const turnCounter = (persisted?.turnCounter ?? 0) + 1;
  const toolCalls: AgentToolCallRecord[] = [];

  type TurnResolution =
    | { type: "yield"; payload: IntentAgentYieldPayload }
    | { type: "commit"; mergedBrief: string };

  const box: { resolution: TurnResolution | null } = { resolution: null };

  const executeToolOverrides: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  > = {
    get_pipeline_constraints: async () => PIPELINE_CONSTRAINTS_TEXT,
    yield_to_user: async (args: Record<string, unknown>) => {
      box.resolution = { type: "yield", payload: parseYieldArgs(args) };
      return JSON.stringify({ ok: true, halted: true, action: "yield_to_user" });
    },
    commit_generate: async (args: Record<string, unknown>) => {
      const raw = typeof args.merged_brief === "string" ? args.merged_brief.trim() : "";
      box.resolution = {
        type: "commit",
        mergedBrief: resolveCommitMergedBrief({
          mergedBriefRaw: raw,
          messages,
          tailUserMessage: userMessage.trim(),
          bootstrapUserPrompt,
        }).trim(),
      };
      return JSON.stringify({ ok: true, halted: true, action: "commit_generate" });
    },
    reference_site_digest: (args: Record<string, unknown>) => executeReferenceSiteDigest(args),
    brand_kit_from_url: (args: Record<string, unknown>) => executeBrandKitFromUrl(args),
    single_page_ia_proposal: (args: Record<string, unknown>) => executeSinglePageIaProposal(args),
    accessibility_and_seo_brief: (args: Record<string, unknown>) => executeAccessibilitySeoBrief(args),
    competitive_landscape_snapshot: (args: Record<string, unknown>) =>
      executeCompetitiveLandscapeSnapshot(args),
  };

  for (const [name, fn] of Object.entries(toolExtensions?.toolHandlers ?? {})) {
    if (INTENT_AGENT_RESERVED_TOOL_NAMES.has(name)) continue;
    executeToolOverrides[name] = fn;
  }

  const { content, toolCalls: calls } = await callLLMWithToolsFromMessages({
    messages,
    tools,
    temperature: 0.35,
    maxIterations: 14,
    model,
    executeToolOverrides,
    onMessage,
    shouldAbortAfterToolResults: () => box.resolution !== null,
    langfusePhase: LfToolPhase.intentAgent,
    onReasoning: onIntentProgress
      ? ({ iteration, text }) => {
          onIntentProgress({
            kind: "reasoning",
            iteration,
            text: truncatePreview(text, 12_000),
          });
        }
      : undefined,
    onAssistantRound: onIntentProgress
      ? ({ iteration, textPreview, toolCallNames }) => {
          onIntentProgress({
            kind: "assistant_round",
            iteration,
            textPreview,
            toolCallNames,
          });
        }
      : undefined,
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
      };
    }

    await clearIntentAgentSession(projectId);
    return {
      status: "commit_generate",
      mergedBrief: merged,
      turnCounter,
      toolCalls,
    };
  }

  if (content.trim()) {
    await saveIntentAgentSession({
      version: 1,
      projectId,
      updatedAt: new Date().toISOString(),
      turnCounter,
      messages,
    });
    const text = content.trim();
    return {
      status: "implicit_yield",
      assistantText: text,
      yieldPayload: {
        kind: "clarify",
        message: text,
        suggestedReplies: [],
        options: [],
      },
      turnCounter,
      toolCalls,
    };
  }

  await saveIntentAgentSession({
    version: 1,
    projectId,
    updatedAt: new Date().toISOString(),
    turnCounter,
    messages,
  });
  return {
    status: "error",
    errorMessage: "Intent agent stopped without yield, commit, or assistant text.",
    turnCounter,
    toolCalls,
  };
}
