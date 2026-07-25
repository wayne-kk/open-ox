import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";
import type { FileSession, FileSessionCall, FileSessionEvent } from "@/ai/shared/fileSession/fileSession";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import type { DurableTaskState } from "@/ai/shared/agentContext";

export type PageBuildPhase = "draft_target" | "build" | "repair" | "complete" | "failed";

export type PageBuildEvent =
  | { kind: "message"; message: ChatMessage }
  | { kind: "assistant_round"; iteration: number }
  | {
      kind: "tool";
      name: string;
      args: Record<string, unknown>;
      iteration: number;
      result: ToolResult | string;
      activity: "read" | "write" | "verify" | "image" | "other";
      path?: string;
    };

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

const PAGE_TOOL = {
  createTarget: "create_target_page",
  createComponent: "create_page_component",
  read: "read_page_file",
  replace: "replace_page_file",
  verify: "verify_page_files",
  image: "generate_image",
} as const;

const CREATE_TARGET_TOOL = functionTool(
  PAGE_TOOL.createTarget,
  "Create the required target page. The runtime owns its path; provide only complete TSX source.",
  { type: "object", properties: { content: { type: "string" } }, required: ["content"] },
);

const CREATE_COMPONENT_TOOL = functionTool(
  PAGE_TOOL.createComponent,
  "Create one page-local component below the assigned component root.",
  {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
);

const READ_TOOL = functionTool(
  PAGE_TOOL.read,
  "Read the canonical content and revision of an owned page file before replacement.",
  { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
);

const REPLACE_TOOL = functionTool(
  PAGE_TOOL.replace,
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
  PAGE_TOOL.verify,
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

function pageToolActivity(
  name: string,
  args: Record<string, unknown>,
  targetPath: string,
): Pick<Extract<PageBuildEvent, { kind: "tool" }>, "activity" | "path"> {
  if (name === PAGE_TOOL.createTarget) return { activity: "write", path: targetPath };
  if (name === PAGE_TOOL.createComponent || name === PAGE_TOOL.replace) {
    return { activity: "write", path: String(args.path ?? "") };
  }
  if (name === PAGE_TOOL.read) return { activity: "read", path: String(args.path ?? "") };
  if (name === PAGE_TOOL.verify) return { activity: "verify" };
  if (name === PAGE_TOOL.image) return { activity: "image" };
  return { activity: "other" };
}

export function pageBuildPhase(spec: Pick<PageBuildSessionSpec, "targetPath" | "fileSession">): PageBuildPhase {
  const decision = spec.fileSession.stopDecision();
  if (decision.kind === "failed") return "failed";
  if (decision.kind === "complete") return "complete";
  if (!spec.fileSession.writtenPaths().includes(spec.targetPath)) return "draft_target";
  return spec.fileSession.currentDiagnostics().length > 0 ? "repair" : "build";
}

function pageBuildRuntimeState(
  spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession">,
) {
  const latestMutations = new Map<string, { path: string; operation: string; revision?: string; outcome: "success" }>();
  for (const event of spec.fileSession.events()) {
    if (!event.path || (event.kind !== "file_created" && event.kind !== "file_updated")) continue;
    latestMutations.set(event.path, {
      path: event.path,
      operation: event.kind,
      ...(event.revision ? { revision: event.revision } : {}),
      outcome: "success",
    });
  }
  return {
    phase: pageBuildPhase(spec),
    decision: spec.fileSession.stopDecision(),
    target: latestEventForPath(spec.fileSession, spec.targetPath),
    writtenPaths: spec.fileSession.writtenPaths(),
    diagnostics: spec.fileSession.currentDiagnostics(),
    mutations: [...latestMutations.values()],
    ownership: `${spec.targetPath}, ${spec.componentRoot}/**`,
  };
}

export function pageBuildTaskState(
  spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession">,
): DurableTaskState {
  const state = pageBuildRuntimeState(spec);
  return {
    goal: `Build route ${spec.slug}`,
    targetPaths: [spec.targetPath],
    mutations: state.mutations,
    unresolvedDiagnostics: state.diagnostics.map((diagnostic) => ({
      path: diagnostic.path,
      summary: diagnostic.message,
    })),
    decisions: [
      `phase=${state.phase}`,
      `next=${state.decision.kind === "continue" ? state.decision.reason : state.decision.kind}`,
      `ownership=${state.ownership}`,
    ],
  };
}

export function pageBuildStateCard(spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession">): string {
  const state = pageBuildRuntimeState(spec);
  return [
    `[Page build state: ${spec.slug}]`,
    `phase: ${state.phase}`,
    `target: ${spec.targetPath}`,
    `target_revision: ${state.target?.revision ?? "missing"}`,
    `written_paths: ${state.writtenPaths.join(", ") || "none"}`,
    `next: ${state.decision.kind === "continue" ? state.decision.reason : state.decision.kind}`,
    `ownership: ${state.ownership}`,
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
  const messages = [...spec.initialMessages];
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
      [PAGE_TOOL.createTarget]: (args) => executeFile({
        name: "create_file",
        args: { path: spec.targetPath, content: String(args.content ?? "") },
      }),
      [PAGE_TOOL.createComponent]: (args) => executeFile({
        name: "create_file",
        args: { path: String(args.path ?? ""), content: String(args.content ?? "") },
      }),
      [PAGE_TOOL.read]: (args) => executeFile({
        name: "read_file_snapshot",
        args: { path: String(args.path ?? "") },
      }),
      [PAGE_TOOL.replace]: (args) => executeFile({
        name: "replace_file",
        args: {
          path: String(args.path ?? ""),
          baseRevision: String(args.baseRevision ?? ""),
          content: String(args.content ?? ""),
        },
      }),
      [PAGE_TOOL.verify]: (args) => executeFile({
        name: "verify_files",
        args: { paths: Array.isArray(args.paths) ? args.paths.map(String) : undefined },
      }),
      ...(spec.image ? { [PAGE_TOOL.image]: spec.image.execute } : {}),
    },
    resolveToolsForIteration: () => toolsForPageBuildPhase(spec),
    resolveToolChoiceForIteration: () => spec.fileSession.stopDecision().kind === "complete" ? "auto" : "required",
    resolveTaskStateForRound: () => pageBuildTaskState(spec),
    onMessage: (message) => spec.onEvent?.({ kind: "message", message }),
    onAssistantRound: ({ iteration }) => {
      iterationsUsed = Math.max(iterationsUsed, iteration + 1);
      spec.onEvent?.({ kind: "assistant_round", iteration });
    },
    onToolCall: (info) => spec.onEvent?.({
      kind: "tool",
      ...info,
      ...pageToolActivity(info.name, info.args, spec.targetPath),
    }),
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
