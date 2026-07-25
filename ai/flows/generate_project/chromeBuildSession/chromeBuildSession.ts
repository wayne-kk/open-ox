import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";
import type { DurableTaskState } from "@/ai/shared/agentContext";
import type {
  FileSession,
  FileSessionCall,
  FileSessionEvent,
  FileSessionWorkspace,
} from "@/ai/shared/fileSession/fileSession";
import { createFileSession } from "@/ai/shared/fileSession/fileSession";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import {
  needsGlobalChromeScaffold,
  normalizeChromeForm,
  type ChromeForm,
} from "../shared/chromeForm";

const LAYOUT_PATH = "app/layout.tsx";
const COMPONENT_ROOT = "components/chrome";

function isChromeComponentPath(path: string): boolean {
  return path.startsWith(`${COMPONENT_ROOT}/`) &&
    (path.endsWith(".tsx") || path.endsWith(".ts")) &&
    !path.includes("\\") &&
    !path.split("/").includes("..");
}

const CHROME_TOOL = {
  createLayout: "create_chrome_layout",
  createComponent: "create_chrome_component",
  read: "read_chrome_file",
  replace: "replace_chrome_file",
  verify: "verify_chrome_files",
} as const;

export type ChromeBuildProfile = "scaffold" | "optimize";
export type ChromeBuildPhase =
  | "draft_layout"
  | "build"
  | "inspect"
  | "repair"
  | "verify"
  | "complete"
  | "failed";

export type ChromeBuildEvent =
  | { kind: "message"; message: ChatMessage }
  | { kind: "assistant_round"; iteration: number }
  | {
      kind: "tool";
      name: string;
      args: Record<string, unknown>;
      iteration: number;
      result: ToolResult | string;
      activity: "read" | "write" | "verify";
      path?: string;
    };

export interface ChromeBuildSessionSpec {
  profile: ChromeBuildProfile;
  chromeForm: ChromeForm;
  initialMessages: ChatMessage[];
  model: string;
  thinkingLevel?: string;
  maxIterations: number;
  workspace: FileSessionWorkspace;
  /** Optimize may adopt only these already-surveyed component files. */
  existingChromePaths?: string[];
  /** Deterministic Scaffold recovery, executed inside the Module through FileSession. */
  fallbackLayoutContent?: string;
  onEvent?(event: ChromeBuildEvent): void;
  langfusePhase: string;
}

type ChromeStopDecision =
  | { kind: "continue"; reason: string }
  | { kind: "complete" }
  | { kind: "failed"; error: string };

export interface ChromeBuildSessionResult {
  content: string;
  toolCalls: AgentToolCallRecord[];
  iterationsUsed: number;
  emptyStopRecoveries: number;
  writtenPaths: string[];
  chromeForm: ChromeForm;
  events: FileSessionEvent[];
  fellBackToMinimal: boolean;
  finalDecision: ChromeStopDecision;
}

export interface ChromeBuildSessionDependencies {
  runToolLoop: typeof callLLMWithToolsFromMessages;
}

const defaultDependencies: ChromeBuildSessionDependencies = {
  runToolLoop: callLLMWithToolsFromMessages,
};

function functionTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): ChatCompletionTool {
  return { type: "function", function: { name, description, parameters } };
}

function createLayoutTool(formMustBeResolved: boolean): ChatCompletionTool {
  return functionTool(
    CHROME_TOOL.createLayout,
    "Create the runtime-owned app/layout.tsx from complete TSX source. This path is create-once.",
    {
      type: "object",
      properties: {
        content: { type: "string" },
        chromeForm: {
          type: "string",
          enum: ["top-nav", "top-nav+footer", "sidebar", "bottom-tabs", "none"],
          description: "The shell family actually implemented. Required only when the plan was unspecified.",
        },
      },
      required: formMustBeResolved ? ["content", "chromeForm"] : ["content"],
    },
  );
}

const CREATE_COMPONENT_TOOL = functionTool(
  CHROME_TOOL.createComponent,
  "Create one new file below components/chrome. A path is create-once.",
  {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
);

const READ_TOOL = functionTool(
  CHROME_TOOL.read,
  "Read canonical content and its exact revision before replacing an owned Chrome file.",
  {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
  },
);

const REPLACE_TOOL = functionTool(
  CHROME_TOOL.replace,
  "Replace an owned Chrome file atomically against the exact revision returned by read_chrome_file.",
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
  CHROME_TOOL.verify,
  "Verify all owned Chrome files. The runtime completes automatically when verification is clean.",
  { type: "object", properties: {} },
);

function eventResult(event: FileSessionEvent): ToolResult {
  return event.success
    ? {
        success: true,
        output: JSON.stringify(event),
        meta: {
          path: event.path,
          revision: event.revision,
          eventKind: event.kind,
          cached: event.cached,
        },
      }
    : {
        success: false,
        error: `${event.code}: ${event.error}`,
        meta: {
          path: event.path,
          revision: event.revision,
          code: event.code,
          retryable: event.retryable,
          eventKind: event.kind,
        },
      };
}

function layoutInvalidReason(content: string): string | null {
  if (!content.trim()) return `${LAYOUT_PATH} is empty`;
  if (!/export\s+default\s+(?:function\b|\w+)/.test(content)) {
    return `${LAYOUT_PATH} must include a default export`;
  }
  if (!/\{\s*children\s*\}/.test(content)) {
    return `${LAYOUT_PATH} must render {children}`;
  }
  return null;
}

function lastEventIndex(events: FileSessionEvent[], predicate: (event: FileSessionEvent) => boolean): number {
  return events.findLastIndex(predicate);
}

function hasCleanVerificationAfterLatestMutation(fileSession: FileSession): boolean {
  const events = fileSession.events();
  const verification = lastEventIndex(events, (event) => event.kind === "files_verified");
  const mutation = lastEventIndex(
    events,
    (event) => event.kind === "file_created" || event.kind === "file_updated",
  );
  return verification >= 0 && verification > mutation && fileSession.currentDiagnostics().length === 0;
}

function chromeStopDecision(fileSession: FileSession): ChromeStopDecision {
  const fileDecision = fileSession.stopDecision();
  if (fileDecision.kind !== "complete") return fileDecision;
  if (!hasCleanVerificationAfterLatestMutation(fileSession)) {
    return { kind: "continue", reason: "clean Chrome verification is required" };
  }
  return { kind: "complete" };
}

function chromeBuildPhase(
  profile: ChromeBuildProfile,
  fileSession: FileSession,
): ChromeBuildPhase {
  const decision = chromeStopDecision(fileSession);
  if (decision.kind === "complete") return "complete";
  if (decision.kind === "failed") return "failed";
  if (profile === "scaffold" && !fileSession.writtenPaths().includes(LAYOUT_PATH)) {
    return "draft_layout";
  }
  if (fileSession.currentDiagnostics().length > 0) return "repair";
  const events = fileSession.events();
  const latestMutation = lastEventIndex(
    events,
    (event) => event.kind === "file_created" || event.kind === "file_updated",
  );
  const latestVerification = lastEventIndex(events, (event) => event.kind === "files_verified");
  if (
    fileSession.stopDecision().kind === "complete" &&
    (profile === "scaffold" || latestMutation > latestVerification)
  ) {
    return "verify";
  }
  return profile === "optimize" ? "inspect" : "build";
}

function toolsForPhase(
  profile: ChromeBuildProfile,
  fileSession: FileSession,
  createLayout: ChatCompletionTool,
): ChatCompletionTool[] {
  const phase = chromeBuildPhase(profile, fileSession);
  if (phase === "draft_layout") return [createLayout];
  if (phase === "complete" || phase === "failed") return [];
  const legalFileTools = new Set(fileSession.tools().map((tool) => tool.function.name));
  if (legalFileTools.size === 1 && legalFileTools.has("read_file_snapshot")) return [READ_TOOL];
  if (phase === "verify") return [VERIFY_TOOL];
  if (profile === "optimize") return [READ_TOOL, REPLACE_TOOL, VERIFY_TOOL];
  return [CREATE_COMPONENT_TOOL, READ_TOOL, REPLACE_TOOL, VERIFY_TOOL];
}

function chromeToolActivity(
  name: string,
  args: Record<string, unknown>,
): Pick<Extract<ChromeBuildEvent, { kind: "tool" }>, "activity" | "path"> {
  if (name === CHROME_TOOL.createLayout) return { activity: "write", path: LAYOUT_PATH };
  if (name === CHROME_TOOL.createComponent || name === CHROME_TOOL.replace) {
    return { activity: "write", path: String(args.path ?? "") };
  }
  if (name === CHROME_TOOL.read) return { activity: "read", path: String(args.path ?? "") };
  return { activity: "verify" };
}

function taskState(
  profile: ChromeBuildProfile,
  form: ChromeForm,
  fileSession: FileSession,
  ownership: string,
): DurableTaskState {
  const latestMutations = new Map<string, {
    path: string;
    operation: string;
    revision?: string;
    outcome: "success";
  }>();
  for (const event of fileSession.events()) {
    if (!event.path || (event.kind !== "file_created" && event.kind !== "file_updated")) continue;
    latestMutations.set(event.path, {
      path: event.path,
      operation: event.kind,
      ...(event.revision ? { revision: event.revision } : {}),
      outcome: "success",
    });
  }
  const decision = chromeStopDecision(fileSession);
  return {
    goal: profile === "scaffold" ? "Create global Chrome" : "Optimize existing global Chrome",
    targetPaths: [LAYOUT_PATH],
    mutations: [...latestMutations.values()],
    unresolvedDiagnostics: fileSession.currentDiagnostics().map((diagnostic) => ({
      path: diagnostic.path,
      summary: diagnostic.message,
    })),
    decisions: [
      `profile=${profile}`,
      `phase=${chromeBuildPhase(profile, fileSession)}`,
      `chrome_form=${form}`,
      `next=${decision.kind === "continue" ? decision.reason : decision.kind}`,
      `ownership=${ownership}`,
    ],
  };
}

function stateCard(
  profile: ChromeBuildProfile,
  form: ChromeForm,
  fileSession: FileSession,
  ownership: string,
): string {
  const state = taskState(profile, form, fileSession, ownership);
  return [
    `[Chrome build state: ${profile}]`,
    `goal: ${state.goal}`,
    `target_paths: ${state.targetPaths?.join(", ") || "none"}`,
    `mutated_paths: ${state.mutations?.map((mutation) => mutation.path).join(", ") || "none"}`,
    ...(state.decisions ?? []),
  ].join("\n");
}

export async function runChromeBuildSession(
  spec: ChromeBuildSessionSpec,
  dependencies: ChromeBuildSessionDependencies = defaultDependencies,
): Promise<ChromeBuildSessionResult> {
  let resolvedForm = spec.chromeForm;
  const existingComponentPaths = (spec.existingChromePaths ?? []).filter(isChromeComponentPath);
  const adoptedPaths = spec.profile === "optimize"
    ? [LAYOUT_PATH, ...existingComponentPaths]
    : [];
  const ownedOptimizePaths = new Set(adoptedPaths);
  const ownership = spec.profile === "scaffold"
    ? `${LAYOUT_PATH}, ${COMPONENT_ROOT}/**`
    : adoptedPaths.join(", ");
  const fileSession = createFileSession({
    owner: `chrome:${spec.profile}`,
    workspace: spec.workspace,
    ownsPath: (path) => spec.profile === "scaffold"
      ? path === LAYOUT_PATH || isChromeComponentPath(path)
      : ownedOptimizePaths.has(path),
    requiredArtifacts: spec.profile === "scaffold"
      ? [LAYOUT_PATH, ...existingComponentPaths]
      : adoptedPaths,
    replaceableBaselinePaths: spec.profile === "scaffold"
      ? [LAYOUT_PATH, ...existingComponentPaths]
      : [],
    validateArtifact: (path, content) => path === LAYOUT_PATH ? layoutInvalidReason(content) : null,
    validateCompletion: ({ artifacts }) => {
      if (spec.profile !== "scaffold" || !needsGlobalChromeScaffold(resolvedForm)) return null;
      return [...artifacts.keys()].some((path) => path.startsWith(`${COMPONENT_ROOT}/`))
        ? null
        : `chrome form ${resolvedForm} requires a ${COMPONENT_ROOT}/** component`;
    },
    maxFiles: 12,
    maxMutationsPerFile: 4,
    maxConsecutiveFailuresPerFile: 2,
  });

  const preloadPaths = spec.profile === "optimize" ? adoptedPaths : existingComponentPaths;
  for (const path of preloadPaths) {
      await fileSession.execute({ name: "read_file_snapshot", args: { path } });
  }

  const createLayout = createLayoutTool(spec.chromeForm === "unspecified");
  const executeFile = async (call: FileSessionCall): Promise<ToolResult> =>
    eventResult(await fileSession.execute(call));
  const executeAuthorized = async (
    name: string,
    action: () => Promise<ToolResult>,
  ): Promise<ToolResult> => {
    const legal = toolsForPhase(spec.profile, fileSession, createLayout)
      .some((tool) => tool.function.name === name);
    return legal
      ? action()
      : {
          success: false,
          error: `ILLEGAL_ACTION: ${name} is not legal in phase ${chromeBuildPhase(spec.profile, fileSession)}`,
        };
  };
  let iterationsUsed = 0;
  let emptyStopRecoveries = 0;

  const { content, toolCalls } = await dependencies.runToolLoop({
    messages: [...spec.initialMessages],
    tools: [createLayout, CREATE_COMPONENT_TOOL, READ_TOOL, REPLACE_TOOL, VERIFY_TOOL],
    contextMode: "managed",
    contextSessionKind: spec.profile === "scaffold" ? "scaffold" : "chrome",
    completionProfile: "code",
    parallelToolCalls: false,
    model: spec.model,
    ...(spec.thinkingLevel ? { thinkingLevel: spec.thinkingLevel } : {}),
    maxIterations: spec.maxIterations,
    executeToolOverrides: {
      [CHROME_TOOL.createLayout]: async (args): Promise<ToolResult> => {
        let declaredForm = resolvedForm;
        if (spec.chromeForm === "unspecified") {
          declaredForm = normalizeChromeForm(args.chromeForm);
          if (declaredForm === "unspecified") {
            return {
              success: false,
              error: "INVALID_ARGUMENT: create_chrome_layout.chromeForm must resolve the unspecified plan",
            };
          }
        }
        return executeAuthorized(CHROME_TOOL.createLayout, async () => {
          const result = await executeFile({
            name: "create_file",
            args: { path: LAYOUT_PATH, content: String(args.content ?? "") },
          });
          if (result.success) resolvedForm = declaredForm;
          return result;
        });
      },
      [CHROME_TOOL.createComponent]: (args) => executeAuthorized(
        CHROME_TOOL.createComponent,
        () => executeFile({
          name: "create_file",
          args: { path: String(args.path ?? ""), content: String(args.content ?? "") },
        }),
      ),
      [CHROME_TOOL.read]: (args) => executeAuthorized(
        CHROME_TOOL.read,
        () => executeFile({
          name: "read_file_snapshot",
          args: { path: String(args.path ?? "") },
        }),
      ),
      [CHROME_TOOL.replace]: (args) => executeAuthorized(
        CHROME_TOOL.replace,
        () => executeFile({
          name: "replace_file",
          args: {
            path: String(args.path ?? ""),
            baseRevision: String(args.baseRevision ?? ""),
            content: String(args.content ?? ""),
          },
        }),
      ),
      [CHROME_TOOL.verify]: () => executeAuthorized(
        CHROME_TOOL.verify,
        () => executeFile({ name: "verify_files", args: {} }),
      ),
    },
    resolveToolsForIteration: () => toolsForPhase(spec.profile, fileSession, createLayout),
    resolveToolChoiceForIteration: () => chromeStopDecision(fileSession).kind === "complete"
      ? "auto"
      : "required",
    resolveTaskStateForRound: () => taskState(spec.profile, resolvedForm, fileSession, ownership),
    shouldAbortAfterToolResults: () => chromeStopDecision(fileSession).kind !== "continue",
    onMessage: (message) => spec.onEvent?.({ kind: "message", message }),
    onAssistantRound: ({ iteration }) => {
      iterationsUsed = Math.max(iterationsUsed, iteration + 1);
      spec.onEvent?.({ kind: "assistant_round", iteration });
    },
    onToolCall: (info) => spec.onEvent?.({
      kind: "tool",
      ...info,
      ...chromeToolActivity(info.name, info.args),
    }),
    onAssistantStop: ({ messages }) => {
      if (chromeStopDecision(fileSession).kind === "complete" || emptyStopRecoveries >= 2) return false;
      emptyStopRecoveries += 1;
      const recovery: ChatMessage = {
        role: "user",
        content: `${stateCard(spec.profile, resolvedForm, fileSession, ownership)}\n[Recovery ${emptyStopRecoveries}/2] Continue with one legal Chrome action.`,
      };
      messages.push(recovery);
      spec.onEvent?.({ kind: "message", message: recovery });
      return true;
    },
    onApproachingLimit: ({ messages }) => {
      const nudge: ChatMessage = {
        role: "user",
        content: `${stateCard(spec.profile, resolvedForm, fileSession, ownership)}\n[Budget] Finish only unresolved Chrome artifacts and verification.`,
      };
      messages.push(nudge);
      spec.onEvent?.({ kind: "message", message: nudge });
    },
    requireTools: true,
    langfusePhase: spec.langfusePhase,
  });

  let resultEvents = fileSession.events();
  let resultWrittenPaths = fileSession.writtenPaths();
  let finalDecision = chromeStopDecision(fileSession);
  let fellBackToMinimal = false;

  if (
    spec.profile === "scaffold" &&
    spec.fallbackLayoutContent &&
    finalDecision.kind !== "complete"
  ) {
    const fallbackSession = createFileSession({
      owner: "chrome:scaffold:fallback",
      workspace: spec.workspace,
      ownsPath: (path) => path === LAYOUT_PATH,
      requiredArtifacts: [LAYOUT_PATH],
      replaceableBaselinePaths: [LAYOUT_PATH],
      validateArtifact: (_path, source) => layoutInvalidReason(source),
      maxFiles: 1,
      maxMutationsPerFile: 1,
      maxConsecutiveFailuresPerFile: 1,
    });
    const fallbackWrite = await fallbackSession.execute({
      name: "create_file",
      args: { path: LAYOUT_PATH, content: spec.fallbackLayoutContent },
    });
    spec.onEvent?.({
      kind: "tool",
      name: CHROME_TOOL.createLayout,
      args: { content: "[deterministic minimal fallback]" },
      iteration: iterationsUsed,
      result: eventResult(fallbackWrite),
      activity: "write",
      path: LAYOUT_PATH,
    });
    if (fallbackWrite.success) {
      const fallbackVerification = await fallbackSession.execute({
        name: "verify_files",
        args: {},
      });
      spec.onEvent?.({
        kind: "tool",
        name: CHROME_TOOL.verify,
        args: {},
        iteration: iterationsUsed,
        result: eventResult(fallbackVerification),
        activity: "verify",
      });
    }
    resultEvents = [...resultEvents, ...fallbackSession.events()];
    resultWrittenPaths = [...new Set([
      ...resultWrittenPaths,
      ...fallbackSession.writtenPaths(),
    ])];
    finalDecision = chromeStopDecision(fallbackSession);
    if (finalDecision.kind === "complete") {
      resolvedForm = "none";
      fellBackToMinimal = true;
    }
  }

  return {
    content,
    toolCalls,
    iterationsUsed,
    emptyStopRecoveries,
    writtenPaths: resultWrittenPaths,
    chromeForm: resolvedForm,
    events: resultEvents,
    fellBackToMinimal,
    finalDecision,
  };
}
