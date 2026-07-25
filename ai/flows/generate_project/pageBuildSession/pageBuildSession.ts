import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";
import type { FileSession, FileSessionArtifact, FileSessionCall, FileSessionEvent } from "@/ai/shared/fileSession/fileSession";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import type { DurableTaskState } from "@/ai/shared/agentContext";

export type PageBuildPhase = "draft_target" | "build" | "repair" | "complete" | "failed";

export type PageArtifactRequirement =
  | {
      kind: "asset_reference";
      path: string;
      reference: string;
      nextAction: "generate_asset" | "edit_source";
      replacement?: string;
    }
  | { kind: "source_diagnostic"; path: string; message: string };

export interface PageAssetLifecycle {
  inspect(artifacts: ReadonlyMap<string, FileSessionArtifact>): readonly PageArtifactRequirement[];
  generation?: {
    tool: ChatCompletionTool;
    execute(args: Record<string, unknown>): Promise<ToolResult | string>;
  };
}

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
  assetLifecycle?: PageAssetLifecycle;
  onEvent?(event: PageBuildEvent): void;
  langfusePhase: string;
}

export interface PageBuildSessionResult {
  content: string;
  toolCalls: AgentToolCallRecord[];
  iterationsUsed: number;
  emptyStopRecoveries: number;
  finalDecision: ReturnType<FileSession["stopDecision"]>;
  finalRequirement?: PageArtifactRequirement;
  finalLegalTools: string[];
  deterministicRecoveries: number;
}

function pageRevisionStatus(
  events: readonly FileSessionEvent[],
  hasArtifacts: boolean,
) {
  const latestMutation = events.findLastIndex(
    (event) =>
      event.kind === "file_created" ||
      event.kind === "file_loaded" ||
      event.kind === "file_updated",
  );
  const latestVerification = events.findLastIndex((event) => event.kind === "files_verified");
  return {
    latestMutation,
    latestVerification,
    needsVerification:
      hasArtifacts && latestVerification < Math.max(latestMutation, 0),
  };
}

function pageBuildDecision(
  spec: Pick<PageBuildSessionSpec, "fileSession" | "assetLifecycle">,
): ReturnType<FileSession["stopDecision"]> {
  const decision = spec.fileSession.stopDecision();
  if (decision.kind !== "complete") return decision;
  const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
  if (requirement) {
    return { kind: "continue", reason: `artifact requirement: ${JSON.stringify(requirement)}` };
  }
  return pageRevisionStatus(
    spec.fileSession.events(),
    spec.fileSession.artifacts().size > 0,
  ).needsVerification
    ? { kind: "continue", reason: "current page revision needs verification" }
    : decision;
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
  edit: "edit_page_file",
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

const EDIT_TOOL = functionTool(
  PAGE_TOOL.edit,
  "Edit exact source text in an owned page file against the revision returned by read_page_file.",
  {
    type: "object",
    properties: {
      path: { type: "string" },
      baseRevision: { type: "string" },
      oldText: { type: "string" },
      newText: { type: "string" },
    },
    required: ["path", "baseRevision", "oldText", "newText"],
  },
);

const VERIFY_TOOL = functionTool(
  PAGE_TOOL.verify,
  "Verify every current page file. Runtime completion is automatic when required artifacts are clean.",
  { type: "object", properties: {} },
);

function pageOwnsPath(
  spec: Pick<PageBuildSessionSpec, "targetPath" | "componentRoot">,
  path: string,
): boolean {
  return path === spec.targetPath || path.startsWith(`${spec.componentRoot}/`);
}

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
  if (name === PAGE_TOOL.createComponent || name === PAGE_TOOL.edit) {
    return { activity: "write", path: String(args.path ?? "") };
  }
  if (name === PAGE_TOOL.read) return { activity: "read", path: String(args.path ?? "") };
  if (name === PAGE_TOOL.verify) return { activity: "verify" };
  if (name === PAGE_TOOL.image) return { activity: "image" };
  return { activity: "other" };
}

export function pageBuildPhase(spec: Pick<PageBuildSessionSpec, "targetPath" | "fileSession" | "assetLifecycle">): PageBuildPhase {
  const decision = pageBuildDecision(spec);
  if (decision.kind === "failed") return "failed";
  if (decision.kind === "complete") return "complete";
  if (!spec.fileSession.artifacts().has(spec.targetPath)) return "draft_target";
  return spec.fileSession.currentDiagnostics().length > 0 ? "repair" : "build";
}

function pageBuildRuntimeState(
  spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession" | "assetLifecycle">,
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
    decision: pageBuildDecision(spec),
    target: latestEventForPath(spec.fileSession, spec.targetPath),
    writtenPaths: spec.fileSession.writtenPaths(),
    diagnostics: spec.fileSession.currentDiagnostics(),
    mutations: [...latestMutations.values()],
    ownership: `${spec.targetPath}, ${spec.componentRoot}/**`,
  };
}

export function pageBuildTaskState(
  spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession" | "assetLifecycle">,
): DurableTaskState {
  const state = pageBuildRuntimeState(spec);
  const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
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
      ...(requirement
        ? [`requirement=${JSON.stringify(requirement)}`]
        : []),
    ],
  };
}

export function pageBuildStateCard(spec: Pick<PageBuildSessionSpec, "slug" | "targetPath" | "componentRoot" | "fileSession" | "assetLifecycle">): string {
  const state = pageBuildRuntimeState(spec);
  const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
  const legalTools = toolsForPageBuildPhase(spec).map((tool) => tool.function.name);
  return [
    `[Page build state: ${spec.slug}]`,
    `phase: ${state.phase}`,
    `target: ${spec.targetPath}`,
    `target_revision: ${state.target?.revision ?? "missing"}`,
    `written_paths: ${state.writtenPaths.join(", ") || "none"}`,
    `next: ${state.decision.kind === "continue" ? state.decision.reason : state.decision.kind}`,
    `requirement: ${requirement ? JSON.stringify(requirement) : "none"}`,
    `legal_tools: ${legalTools.join(", ") || "none"}`,
    `ownership: ${state.ownership}`,
  ].join("\n");
}

export function toolsForPageBuildPhase(spec: Pick<PageBuildSessionSpec, "targetPath" | "componentRoot" | "fileSession" | "assetLifecycle">): ChatCompletionTool[] {
  const phase = pageBuildPhase(spec);
  if (phase === "draft_target") return [CREATE_TARGET_TOOL];
  if (phase === "complete" || phase === "failed") return [];
  const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
  if (requirement?.kind === "asset_reference" && requirement.nextAction === "generate_asset") {
    return spec.assetLifecycle?.generation ? [spec.assetLifecycle.generation.tool] : [];
  }
  if (requirement) {
    const fileTools = new Set(spec.fileSession.tools().map((tool) => tool.function.name));
    if (fileTools.size === 1 && fileTools.has("read_file_snapshot")) return [READ_TOOL];
    const pathEvents = spec.fileSession.events().filter((event) => event.path === requirement.path);
    const latestMutation = pathEvents.findLastIndex(
      (event) => event.kind === "file_created" || event.kind === "file_updated",
    );
    const latestSnapshot = pathEvents.findLastIndex((event) => event.kind === "file_snapshot");
    return latestSnapshot > latestMutation ? [EDIT_TOOL] : [READ_TOOL];
  }
  if (
    pageRevisionStatus(
      spec.fileSession.events(),
      spec.fileSession.artifacts().size > 0,
    ).needsVerification &&
    spec.fileSession.stopDecision().kind === "complete"
  ) {
    return [VERIFY_TOOL];
  }
  const legal = new Set(spec.fileSession.tools().map((tool) => tool.function?.name));
  if (legal.size === 1 && legal.has("read_file_snapshot")) return [READ_TOOL];
  return [CREATE_COMPONENT_TOOL, READ_TOOL, EDIT_TOOL, VERIFY_TOOL, ...(spec.assetLifecycle?.generation ? [spec.assetLifecycle.generation.tool] : [])];
}

function exactTextEdits(content: string, oldText: string, newText: string) {
  if (!oldText) return [];
  const offsets: number[] = [];
  for (let offset = content.indexOf(oldText); offset >= 0; offset = content.indexOf(oldText, offset + oldText.length)) {
    offsets.push(offset);
  }
  const position = (offset: number) => {
    const prefix = content.slice(0, offset);
    const lines = prefix.split("\n");
    return { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 };
  };
  return offsets.map((offset) => ({
    range: { start: position(offset), end: position(offset + oldText.length) },
    newText,
  }));
}

export async function runPageBuildSession(spec: PageBuildSessionSpec): Promise<PageBuildSessionResult> {
  await spec.fileSession.loadIfExists(spec.targetPath);
  const messages = [...spec.initialMessages];
  let iterationsUsed = 0;
  let emptyStopRecoveries = 0;
  let deterministicRecoveries = 0;
  let pendingComponentEditPath: string | null = null;

  const runtimeTools = (): ChatCompletionTool[] => {
    if (!pendingComponentEditPath) return toolsForPageBuildPhase(spec);
    const latestPathEvent = spec.fileSession.events()
      .filter((event) => event.path === pendingComponentEditPath)
      .at(-1);
    return latestPathEvent?.kind === "file_snapshot" ? [EDIT_TOOL] : [READ_TOOL];
  };

  const executeFile = async (call: FileSessionCall): Promise<ToolResult> =>
    eventResult(await spec.fileSession.execute(call));

  const illegalCommand = (name: string): ToolResult => ({
    success: false,
    error: `ILLEGAL_LIFECYCLE_COMMAND: ${name} is not legal in the current page artifact state`,
    meta: { code: "ILLEGAL_LIFECYCLE_COMMAND", retryable: true },
  });
  const authorize = async (
    name: string,
    args: Record<string, unknown>,
    execute: () => Promise<ToolResult | string>,
  ): Promise<ToolResult | string> => {
    const legal = runtimeTools().some((tool) => tool.function.name === name);
    if (!legal) return illegalCommand(name);
    const path = String(args.path ?? "");
    if (
      pendingComponentEditPath &&
      (name === PAGE_TOOL.read || name === PAGE_TOOL.edit) &&
      path !== pendingComponentEditPath
    ) {
      return illegalCommand(name);
    }
    const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
    if (
      requirement?.kind === "asset_reference" &&
      (name === PAGE_TOOL.read || name === PAGE_TOOL.edit) &&
      path !== requirement.path
    ) {
      return illegalCommand(name);
    }
    if (
      (name === PAGE_TOOL.createComponent || name === PAGE_TOOL.read || name === PAGE_TOOL.edit) &&
      !pageOwnsPath(spec, path)
    ) {
      return illegalCommand(name);
    }
    if (name === PAGE_TOOL.createComponent) {
      if (await spec.fileSession.loadIfExists(path)) {
        pendingComponentEditPath = path;
        return {
          success: false,
          error: `FILE_ALREADY_EXISTS: ${path}. Creation is not allowed; continue with read_page_file, then edit_page_file.`,
          meta: { path, code: "EXISTING_ARTIFACT", retryable: true, transition: "snapshot_required" },
        };
      }
    }
    return execute();
  };

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [CREATE_TARGET_TOOL, CREATE_COMPONENT_TOOL, READ_TOOL, EDIT_TOOL, VERIFY_TOOL, ...(spec.assetLifecycle?.generation ? [spec.assetLifecycle.generation.tool] : [])],
    temperature: 0.5,
    maxIterations: spec.maxIterations,
    completionProfile: "code",
    contextSessionKind: "page",
    contextMode: "managed",
    model: spec.model,
    ...(spec.thinkingLevel ? { thinkingLevel: spec.thinkingLevel } : {}),
    executeToolOverrides: {
      [PAGE_TOOL.createTarget]: (args) => authorize(PAGE_TOOL.createTarget, args, () => executeFile({
        name: "create_file",
        args: { path: spec.targetPath, content: String(args.content ?? "") },
      })),
      [PAGE_TOOL.createComponent]: (args) => authorize(PAGE_TOOL.createComponent, args, () => executeFile({
        name: "create_file",
        args: { path: String(args.path ?? ""), content: String(args.content ?? "") },
      })),
      [PAGE_TOOL.read]: (args) => authorize(PAGE_TOOL.read, args, () => executeFile({
        name: "read_file_snapshot",
        args: { path: String(args.path ?? "") },
      })),
      [PAGE_TOOL.edit]: (args) => authorize(PAGE_TOOL.edit, args, async () => {
        const path = String(args.path ?? "");
        const oldText = String(args.oldText ?? "");
        const edits = exactTextEdits(
          spec.fileSession.artifacts().get(path)?.content ?? "",
          oldText,
          String(args.newText ?? ""),
        );
        if (edits.length === 0) {
          return {
            success: false,
            error: `EDIT_TEXT_NOT_FOUND: ${oldText}`,
            meta: { path, code: "EDIT_TEXT_NOT_FOUND", retryable: true },
          };
        }
        const result = await executeFile({
          name: "apply_file_patch",
          args: { path, baseRevision: String(args.baseRevision ?? ""), edits },
        });
        if (result.success && pendingComponentEditPath === path) {
          pendingComponentEditPath = null;
        }
        return result;
      }),
      [PAGE_TOOL.verify]: (args) => authorize(PAGE_TOOL.verify, args, () => executeFile({
        name: "verify_files",
        args: {},
      })),
      ...(spec.assetLifecycle?.generation ? {
        [PAGE_TOOL.image]: (args: Record<string, unknown>) => authorize(PAGE_TOOL.image, args, () => {
          const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
          const declaredPath = requirement?.kind === "asset_reference" &&
              requirement.nextAction === "generate_asset" &&
              requirement.reference.startsWith("/images/")
            ? requirement.reference.split(/[?#]/, 1)[0]
            : null;
          const filename = declaredPath?.slice("/images/".length).replace(/\.[^.]+$/, "");
          return spec.assetLifecycle!.generation!.execute({
            ...args,
            ...(filename ? { filename } : {}),
          });
        }),
      } : {}),
    },
    resolveToolsForIteration: runtimeTools,
    resolveToolChoiceForIteration: () => pageBuildDecision(spec).kind === "complete" ? "auto" : "required",
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
      const decision = pageBuildDecision(spec);
      if (decision.kind === "complete" || emptyStopRecoveries >= 2) return false;
      emptyStopRecoveries += 1;
      const recovery: ChatMessage = {
        role: "user",
        content:
          `${pageBuildStateCard(spec)}\n` +
          `[Recovery ${emptyStopRecoveries}/2] The page is not complete. ` +
          `Call exactly one tool from legal_tools now. Do not return text and do not stop.`,
      };
      history.push(recovery);
      spec.onEvent?.({ kind: "message", message: recovery });
      return true;
    },
    shouldAbortAfterToolResults: () => pageBuildDecision(spec).kind !== "continue",
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

  if (emptyStopRecoveries >= 2 && pageBuildDecision(spec).kind === "continue") {
    for (let recovery = 0; recovery < 8; recovery += 1) {
      const before = pageBuildDecision(spec);
      if (before.kind !== "continue") break;
      const requirement = spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0];
      let result: ToolResult | string | null = null;
      let toolName = "";
      let args: Record<string, unknown> = {};

      if (
        requirement?.kind === "asset_reference" &&
        requirement.nextAction === "generate_asset" &&
        spec.assetLifecycle?.generation
      ) {
        toolName = PAGE_TOOL.image;
        args = {
          filename: `${spec.slug}-asset-${recovery + 1}`,
          prompt:
            `Create a production-ready image for the ${spec.slug} page. ` +
            `It replaces the current asset reference ${requirement.reference}.`,
        };
        result = await spec.assetLifecycle.generation.execute(args);
      } else if (
        requirement?.kind === "asset_reference" &&
        requirement.nextAction === "edit_source" &&
        requirement.replacement
      ) {
        toolName = PAGE_TOOL.edit;
        const snapshot = await spec.fileSession.execute({
          name: "read_file_snapshot",
          args: { path: requirement.path },
        });
        if (!snapshot.success || !snapshot.content || !snapshot.revision) break;
        const edits = exactTextEdits(snapshot.content, requirement.reference, requirement.replacement);
        if (edits.length === 0) break;
        args = {
          path: requirement.path,
          baseRevision: snapshot.revision,
          oldText: requirement.reference,
          newText: requirement.replacement,
        };
        result = await executeFile({
          name: "apply_file_patch",
          args: {
            path: requirement.path,
            baseRevision: snapshot.revision,
            edits,
          },
        });
      } else if (!requirement && runtimeTools()[0]?.function.name === PAGE_TOOL.verify) {
        toolName = PAGE_TOOL.verify;
        result = await executeFile({ name: "verify_files", args: {} });
      } else {
        break;
      }

      deterministicRecoveries += 1;
      spec.onEvent?.({
        kind: "tool",
        name: toolName,
        args,
        iteration: iterationsUsed + recovery,
        result: result ?? { success: false, error: "deterministic recovery produced no result" },
        ...pageToolActivity(toolName, args, spec.targetPath),
      });
      if (typeof result !== "string" && !result?.success) break;
      const after = pageBuildDecision(spec);
      if (JSON.stringify(after) === JSON.stringify(before)) break;
    }
  }

  return {
    content,
    toolCalls,
    iterationsUsed,
    emptyStopRecoveries,
    finalDecision: pageBuildDecision(spec),
    finalRequirement: spec.assetLifecycle?.inspect(spec.fileSession.artifacts())[0],
    finalLegalTools: runtimeTools().map((tool) => tool.function.name),
    deterministicRecoveries,
  };
}
