import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";
import type { FileSession, FileSessionCall, FileSessionEvent } from "@/ai/shared/fileSession/fileSession";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";

export type PageBuildPhase = "draft_target" | "build" | "repair" | "complete" | "failed";

export type PageBuildEvent =
  | { kind: "message"; message: ChatMessage }
  | { kind: "assistant_round"; iteration: number }
  | { kind: "tool"; name: string; args: Record<string, unknown>; iteration: number; result: ToolResult | string };

export interface PageBuildSessionSpec {
  slug: string;
  targetPath: string;
  componentRoot: string;
  initialMessages: ChatMessage[];
  model: string;
  thinkingLevel?: string;
  maxIterations: number;
  fileSession: FileSession;
  image?: {
    tool: ChatCompletionTool;
    execute(args: Record<string, unknown>): Promise<ToolResult | string>;
  };
  onEvent?(event: PageBuildEvent): void;
  langfusePhase: string;
}

export interface PageBuildSessionResult {
  content: string;
  toolCalls: AgentToolCallRecord[];
  iterationsUsed: number;
  emptyStopRecoveries: number;
  finalDecision: ReturnType<FileSession["stopDecision"]>;
}

const functionTool = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): ChatCompletionTool => ({ type: "function", function: { name, description, parameters } });

const CREATE_TARGET_TOOL = functionTool(
  "create_target_page",
  "Create the required target page. The runtime owns its path; provide only complete TSX source.",
  { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
);

const CREATE_COMPONENT_TOOL = functionTool(
  "create_page_component",
  "Create one page-local component below the assigned component root.",
  {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
);

const READ_TOOL = functionTool(
  "read_page_file",
  "Read the canonical content and revision of an owned page file before replacement.",
  { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
);

const REPLACE_TOOL = functionTool(
  "replace_page_file",
  "Replace an owned page file atomically against the exact revision returned by read_page_file.",
  {
    type: "object",
    properties: {
      path: { type: "string" },
      baseRevision: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "baseRevision", "content"],
  },
);

const VERIFY_TOOL = functionTool(
  "verify_page_files",
  "Verify the current page files. Runtime completion is automatic when required artifacts are clean.",
  { type: "object", properties: { paths: { type: "array", items: { type: "string" } } } },
);

function eventResult(event: FileSessionEvent): ToolResult {
  return event.success
    ? {
        success: true,
        output: JSON.stringify(event),
        meta: { path: event.path, revision: event.revision, eventKind: event.kind, cached: event.cached },
      }
    : {
        success: false,
        error: `${event.code}: ${event.error}`,
        meta: { path: event.path, code: event.code, retryable: event.retryable, eventKind: event.kind },
      };
}

function latestEventForPath(session: FileSession, path: string): FileSessionEvent | undefined {
  return session.events().findLast((event) => event.path === path);
}

export function pageBuildPhase(spec: Pick<PageBuildSessionSpec, "targetPath" | "fileSession">): PageBuildPhase {
  const decision = spec.fileSession.stopDecision();
  if (decision.kind === "failed") return "failed";
  if (decision.kind === "complete") return "complete";
  if (!spec.fileSession.writtenPaths().includes(spec.targetPath)) return "draft_target";
  return spec.fileSession.events().some((event) => event.diagnostics?.length) ? "repair" : "build";
}

export function pageBuildStateCard(spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession">): string {
  const phase = pageBuildPhase(spec);
  const target = latestEventForPath(spec.fileSession, spec.targetPath);
  const decision = spec.fileSession.stopDecision();
  return [
    `[Page build state: ${spec.slug}]`,
    `phase: ${phase}`,
    `target: ${spec.targetPath}`,
    `target_revision: ${target?.revision ?? "missing"}`,
    `written_paths: ${spec.fileSession.writtenPaths().join(", ") || "none"}`,
    `next: ${decision.kind === "continue" ? decision.reason : decision.kind}`,
    `ownership: ${spec.targetPath}, ${spec.componentRoot}/**`,
  ].join("\n");
}

export function toolsForPageBuildPhase(spec: Pick<PageBuildSessionSpec, "targetPath" | "fileSession" | "image">): ChatCompletionTool[] {
  const phase = pageBuildPhase(spec);
  if (phase === "draft_target") return [CREATE_TARGET_TOOL];
  if (phase === "complete" || phase === "failed") return [];
  const legal = new Set(spec.fileSession.tools().map((tool) => tool.function?.name));
  if (legal.size === 1 && legal.has("read_file_snapshot")) return [READ_TOOL];
  return [CREATE_COMPONENT_TOOL, READ_TOOL, REPLACE_TOOL, VERIFY_TOOL, ...(spec.image ? [spec.image.tool] : [])];
}

export async function runPageBuildSession(spec: PageBuildSessionSpec): Promise<PageBuildSessionResult> {
  let lastStateCard = pageBuildStateCard(spec);
  const messages = [...spec.initialMessages, { role: "user" as const, content: lastStateCard }];
  let iterationsUsed = 0;
  let emptyStopRecoveries = 0;

  const executeFile = async (call: FileSessionCall): Promise<ToolResult> =>
    eventResult(await spec.fileSession.execute(call));

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [CREATE_TARGET_TOOL, CREATE_COMPONENT_TOOL, READ_TOOL, REPLACE_TOOL, VERIFY_TOOL, ...(spec.image ? [spec.image.tool] : [])],
    temperature: 0.5,
    maxIterations: spec.maxIterations,
    completionProfile: "code",
    contextSessionKind: "page",
    contextMode: "managed",
    model: spec.model,
    ...(spec.thinkingLevel ? { thinkingLevel: spec.thinkingLevel } : {}),
    executeToolOverrides: {
      create_target_page: (args) => executeFile({
        name: "create_file",
        args: { path: spec.targetPath, content: String(args.content ?? "") },
      }),
      create_page_component: (args) => executeFile({
        name: "create_file",
        args: { path: String(args.path ?? ""), content: String(args.content ?? "") },
      }),
      read_page_file: (args) => executeFile({
        name: "read_file_snapshot",
        args: { path: String(args.path ?? "") },
      }),
      replace_page_file: (args) => executeFile({
        name: "replace_file",
        args: {
          path: String(args.path ?? ""),
          baseRevision: String(args.baseRevision ?? ""),
          content: String(args.content ?? ""),
        },
      }),
      verify_page_files: (args) => executeFile({
        name: "verify_files",
        args: { paths: Array.isArray(args.paths) ? args.paths.map(String) : undefined },
      }),
      ...(spec.image ? { generate_image: spec.image.execute } : {}),
    },
    resolveToolsForIteration: () => toolsForPageBuildPhase(spec),
    resolveToolChoiceForIteration: () => spec.fileSession.stopDecision().kind === "complete" ? "auto" : "required",
    compactMessagesBeforeRound: ({ messages: history }) => {
      const currentStateCard = pageBuildStateCard(spec);
      if (currentStateCard === lastStateCard) return;
      lastStateCard = currentStateCard;
      const stateMessage: ChatMessage = { role: "user", content: currentStateCard };
      history.push(stateMessage);
      spec.onEvent?.({ kind: "message", message: stateMessage });
    },
    onMessage: (message) => spec.onEvent?.({ kind: "message", message }),
    onAssistantRound: ({ iteration }) => {
      iterationsUsed = Math.max(iterationsUsed, iteration + 1);
      spec.onEvent?.({ kind: "assistant_round", iteration });
    },
    onToolCall: (info) => spec.onEvent?.({ kind: "tool", ...info }),
    onAssistantStop: ({ messages: history }) => {
      const decision = spec.fileSession.stopDecision();
      if (decision.kind === "complete" || emptyStopRecoveries >= 2) return false;
      emptyStopRecoveries += 1;
      const recovery: ChatMessage = {
        role: "user",
        content: `${pageBuildStateCard(spec)}\n[Recovery ${emptyStopRecoveries}/2] Continue with one currently legal action.`,
      };
      history.push(recovery);
      spec.onEvent?.({ kind: "message", message: recovery });
      return true;
    },
    shouldAbortAfterToolResults: () => spec.fileSession.stopDecision().kind !== "continue",
    requireTools: true,
    onApproachingLimit: ({ messages: history }) => {
      const nudge: ChatMessage = {
        role: "user",
        content: `${pageBuildStateCard(spec)}\n[Budget] Finish only the required target and unresolved verification work.`,
      };
      history.push(nudge);
      spec.onEvent?.({ kind: "message", message: nudge });
    },
    langfusePhase: spec.langfusePhase,
  });

  return {
    content,
    toolCalls,
    iterationsUsed,
    emptyStopRecoveries,
    finalDecision: spec.fileSession.stopDecision(),
  };
}
