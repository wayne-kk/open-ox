import type { ChatCompletionTool } from "openai/resources/chat/completions";
import ts from "typescript";
import type { ToolResult } from "@/ai/tools";
import type {
  FileSession,
  FileSessionArtifact,
} from "@/ai/shared/fileSession/fileSession";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import type { AgentToolCallRecord, ChatMessage } from "@/ai/shared/llm/types";
import type { DurableTaskState } from "@/ai/shared/agentContext";
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceCapability,
  type AgentWorkspaceFinding,
} from "@/ai/shared/agentWorkspaceRuntime";

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
  inspect(
    artifacts: ReadonlyMap<string, FileSessionArtifact>,
  ): readonly PageArtifactRequirement[];
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
  isPrimaryArtifactValid?(content: string): boolean;
  explicitCompletion?: boolean;
  /** Defer TypeScript/build verification to the project-level repair pipeline. */
  deferVerification?: boolean;
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

const functionTool = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): ChatCompletionTool => ({
  type: "function",
  function: { name, description, parameters },
});

const PAGE_TOOL = {
  create: "create_page_file",
  read: "read_page_file",
  edit: "edit_page_file",
  verify: "verify_page_files",
  image: "generate_image",
} as const;

function pageAssemblyIncompleteReason(source: string, componentRoot: string): string | null {
  const sourceFile = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const localBindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.startsWith(`@/${componentRoot}/`)) continue;
    const binding = statement.importClause?.name?.text;
    if (binding) localBindings.add(binding);
  }
  if (localBindings.size === 0) {
    return `Final page must import and render at least one page-local component from ${componentRoot}/**`;
  }
  let rendersLocalComponent = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      localBindings.has(node.tagName.text)
    ) {
      rendersLocalComponent = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rendersLocalComponent
    ? null
    : `Final page must render an imported page-local component from ${componentRoot}/**`;
}
const CREATE_PAGE_FILE_TOOL = functionTool(
  PAGE_TOOL.create,
  "Create one owned page file. Use the assigned target path or a TSX component below the assigned component root.",
  {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
);

const READ_TOOL = functionTool(
  PAGE_TOOL.read,
  "Read the canonical content and revision of an owned page file before replacement.",
  {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
  },
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

const COMPLETE_TOOL = functionTool(
  "page_implementation_complete",
  "Finish after the target page is a thin assembly layer, reusable page components are extracted, and required assets are ready.",
  {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
);

function pageToolActivity(
  name: string,
  args: Record<string, unknown>,
  result?: ToolResult | string,
): Pick<Extract<PageBuildEvent, { kind: "tool" }>, "activity" | "path"> {
  if (
    name === PAGE_TOOL.create &&
    typeof result === "object" &&
    result.meta?.code === "EXISTING_ARTIFACT"
  ) {
    return { activity: "read", path: String(args.path ?? "") };
  }
  if (name === PAGE_TOOL.create || name === PAGE_TOOL.edit) {
    return { activity: "write", path: String(args.path ?? "") };
  }
  if (name === PAGE_TOOL.read)
    return { activity: "read", path: String(args.path ?? "") };
  if (name === PAGE_TOOL.verify) return { activity: "verify" };
  if (name === PAGE_TOOL.image) return { activity: "image" };
  return { activity: "other" };
}

function pageFindings(
  assetLifecycle: PageAssetLifecycle | undefined,
  artifacts: ReadonlyMap<string, FileSessionArtifact>,
): AgentWorkspaceFinding[] {
  return (assetLifecycle?.inspect(artifacts) ?? []).map((requirement) => {
    if (requirement.kind === "source_diagnostic") {
      return {
        code: "UNVERIFIABLE_SOURCE",
        message: requirement.message,
        path: requirement.path,
        blocking: false,
      };
    }
    return {
      code:
        requirement.nextAction === "generate_asset"
          ? "MISSING_ASSET"
          : "SOURCE_REFERENCE_REQUIRES_EDIT",
      message: `artifact requirement: ${JSON.stringify(requirement)}`,
      path: requirement.path,
      blocking: true,
      resolution:
        requirement.nextAction === "generate_asset"
          ? { kind: "external" as const, capability: PAGE_TOOL.image }
          : { kind: "edit" as const, path: requirement.path },
    };
  });
}

function toolsForCapabilities(
  capabilities: readonly AgentWorkspaceCapability[],
  assetLifecycle?: PageAssetLifecycle,
): ChatCompletionTool[] {
  return capabilities.flatMap((capability) => {
    if (capability.kind === "create_primary" || capability.kind === "create") {
      return [CREATE_PAGE_FILE_TOOL];
    }
    if (capability.kind === "read") return [READ_TOOL];
    if (capability.kind === "edit") return [EDIT_TOOL];
    if (capability.kind === "verify") return [VERIFY_TOOL];
    return capability.capability === PAGE_TOOL.image &&
      assetLifecycle?.generation
      ? [assetLifecycle.generation.tool]
      : [];
  });
}

export async function runPageBuildSession(
  spec: PageBuildSessionSpec,
): Promise<PageBuildSessionResult> {
  const messages = [...spec.initialMessages];
  const isPrimaryArtifactValid =
    spec.isPrimaryArtifactValid ??
    ((content: string) =>
      content.trim().length > 0 && !content.includes("Preparing your site"));
  let iterationsUsed = 0;
  let emptyStopRecoveries = 0;
  let deterministicRecoveries = 0;
  const executeImage = async (args: Record<string, unknown>) => {
    const requirement = spec.assetLifecycle?.inspect(
      spec.fileSession.snapshot().artifacts,
    )[0];
    const declaredPath =
      requirement?.kind === "asset_reference" &&
      requirement.nextAction === "generate_asset" &&
      requirement.reference.startsWith("/images/")
        ? requirement.reference.split(/[?#]/, 1)[0]
        : null;
    const filename = declaredPath
      ?.slice("/images/".length)
      .replace(/\.[^.]+$/, "");
    return spec.assetLifecycle!.generation!.execute({
      ...args,
      ...(filename ? { filename } : {}),
    });
  };
  const runtime = createAgentWorkspaceRuntime({
    fileSession: spec.fileSession,
    profile: {
      projection: {
        label: `Page build state: ${spec.slug}`,
        goal: `Build route ${spec.slug}`,
        targetPaths: [spec.targetPath],
        ownership: `${spec.targetPath}, ${spec.componentRoot}/**`,
      },
      primaryArtifact: {
        path: spec.targetPath,
        requireSessionWriteWhenInvalid: true,
        allowSupportingArtifactsBeforePrimary: true,
        isValid: isPrimaryArtifactValid,
      },
      explicitCompletion: spec.explicitCompletion,
      inspectFindings: (artifacts) =>
        pageFindings(spec.assetLifecycle, artifacts),
    },
    externalActions: spec.assetLifecycle?.generation
      ? { [PAGE_TOOL.image]: executeImage }
      : {},
  });
  await runtime.initialize();
  let completedByAgent = false;
  const completionReady = () => {
    const snapshot = spec.fileSession.snapshot();
    const primarySource = snapshot.artifacts.get(spec.targetPath)?.content;
    return (
      snapshot.decision.kind === "complete" &&
      (spec.deferVerification || !snapshot.needsVerification) &&
      snapshot.diagnostics.length === 0 &&
      Boolean(primarySource) &&
      pageAssemblyIncompleteReason(primarySource!, spec.componentRoot) === null
    );
  };

  const runtimeTools = (): ChatCompletionTool[] => {
    const tools = [
      ...toolsForCapabilities(runtime.plan().capabilities, spec.assetLifecycle),
      ...(spec.explicitCompletion && completionReady() ? [COMPLETE_TOOL] : []),
    ].filter(
      (tool) => !spec.deferVerification || tool.function.name !== PAGE_TOOL.verify,
    );
    const uniqueTools = tools.filter(
      (tool, index) =>
        tools.findIndex(
          (candidate) => candidate.function.name === tool.function.name,
        ) === index,
    );
    return uniqueTools;
  };
  const runtimeStateCard = (): string => {
    const projection = runtime.project();
    const legalTools =
      runtimeTools()
        .map((tool) => tool.function.name)
        .join(", ") || "none";
    const primarySource = spec.fileSession.snapshot().artifacts.get(spec.targetPath)?.content;
    const assemblyRequirement = primarySource
      ? pageAssemblyIncompleteReason(primarySource, spec.componentRoot)
      : null;
    return `${projection.contextCard}\nassembly_requirement: ${assemblyRequirement ?? "satisfied or not yet applicable"}\nlegal_tools: ${legalTools}`;
  };
  const runtimeTaskState = (): DurableTaskState => runtime.project().taskState;

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [
      CREATE_PAGE_FILE_TOOL,
      READ_TOOL,
      EDIT_TOOL,
      ...(!spec.deferVerification ? [VERIFY_TOOL] : []),
      ...(spec.explicitCompletion ? [COMPLETE_TOOL] : []),
      ...(spec.assetLifecycle?.generation
        ? [spec.assetLifecycle.generation.tool]
        : []),
    ],
    temperature: 0.5,
    maxIterations: spec.maxIterations,
    completionProfile: "code",
    contextSessionKind: "page",
    contextMode: "managed",
    model: spec.model,
    ...(spec.thinkingLevel ? { thinkingLevel: spec.thinkingLevel } : {}),
    executeToolOverrides: {
      [PAGE_TOOL.create]: (args) => {
        const path = String(args.path ?? "");
        return runtime.execute({
          kind: "create",
          path,
          content: String(args.content ?? ""),
        });
      },
      [PAGE_TOOL.read]: (args) =>
        runtime.execute({
          kind: "read",
          path: String(args.path ?? ""),
        }),
      [PAGE_TOOL.edit]: (args) =>
        runtime.execute({
          kind: "edit",
          path: String(args.path ?? ""),
          baseRevision: String(args.baseRevision ?? ""),
          oldText: String(args.oldText ?? ""),
          newText: String(args.newText ?? ""),
        }),
      [PAGE_TOOL.verify]: () => runtime.execute({ kind: "verify" }),
      page_implementation_complete: async (args) => {
        if (!completionReady()) {
          const primarySource = spec.fileSession.snapshot().artifacts.get(spec.targetPath)?.content;
          return {
            success: false,
            error:
              (primarySource && pageAssemblyIncompleteReason(primarySource, spec.componentRoot)) ||
              (spec.deferVerification
                ? "Page output contract must be complete before project-level verification"
                : "Page files must be valid and cleanly verified before completion"),
            meta: { code: "VERIFICATION_REQUIRED", retryable: true },
          };
        }
        completedByAgent = true;
        return {
          success: true,
          output: String(args.summary ?? "Page implementation complete"),
        };
      },
      ...(spec.assetLifecycle?.generation
        ? {
            [PAGE_TOOL.image]: (args: Record<string, unknown>) =>
              runtime.execute({
                kind: "external",
                capability: PAGE_TOOL.image,
                args,
              }),
          }
        : {}),
    },
    resolveToolsForIteration: runtimeTools,
    resolveToolChoiceForIteration: () =>
      spec.explicitCompletion || runtime.plan().decision.kind !== "complete"
        ? "required"
        : "auto",
    resolveTaskStateForRound: runtimeTaskState,
    onMessage: (message) => spec.onEvent?.({ kind: "message", message }),
    onAssistantRound: ({ iteration }) => {
      iterationsUsed = Math.max(iterationsUsed, iteration + 1);
      spec.onEvent?.({ kind: "assistant_round", iteration });
    },
    onToolCall: (info) =>
      spec.onEvent?.({
        kind: "tool",
        ...info,
        ...pageToolActivity(info.name, info.args, info.result),
      }),
    onAssistantStop: ({ messages: history }) => {
      const decision = runtime.plan().decision;
      if (
        (spec.explicitCompletion
          ? completedByAgent
          : decision.kind === "complete") ||
        decision.kind === "failed" ||
        emptyStopRecoveries >= 2
      )
        return false;
      emptyStopRecoveries += 1;
      const recovery: ChatMessage = {
        role: "user",
        content:
          `${runtimeStateCard()}\n` +
          `[Recovery ${emptyStopRecoveries}/2] The page is not complete. ` +
          `Call exactly one tool from legal_tools now. Continue your page implementation from the current workspace state. Do not return text and do not stop.`,
      };
      history.push(recovery);
      spec.onEvent?.({ kind: "message", message: recovery });
      return true;
    },
    shouldAbortAfterToolResults: () =>
      spec.explicitCompletion
        ? completedByAgent || runtime.plan().decision.kind === "failed"
        : runtime.plan().decision.kind !== "continue",
    requireTools: true,
    onApproachingLimit: ({ messages: history }) => {
      const nudge: ChatMessage = {
        role: "user",
        content: `${runtimeStateCard()}\n[Budget] Finish only the required target and unresolved verification work.`,
      };
      history.push(nudge);
      spec.onEvent?.({ kind: "message", message: nudge });
    },
    langfusePhase: spec.langfusePhase,
  });

  if (emptyStopRecoveries >= 2 && runtime.plan().decision.kind === "continue") {
    for (let recovery = 0; recovery < 8; recovery += 1) {
      const before = runtime.plan().decision;
      if (before.kind !== "continue") break;
      const requirement = spec.assetLifecycle
        ?.inspect(spec.fileSession.snapshot().artifacts)
        .find((candidate) => candidate.kind === "asset_reference");
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
        result = await runtime.execute({
          kind: "external",
          capability: PAGE_TOOL.image,
          args,
        });
      } else if (
        requirement?.kind === "asset_reference" &&
        requirement.nextAction === "edit_source" &&
        requirement.replacement
      ) {
        toolName = PAGE_TOOL.edit;
        const capabilities = runtime.plan().capabilities;
        let baseRevision: string | undefined;
        if (
          capabilities.some(
            (capability) =>
              capability.kind === "read" &&
              capability.path === requirement.path,
          )
        ) {
          const snapshot = await runtime.execute({
            kind: "read",
            path: requirement.path,
          });
          if (
            typeof snapshot === "string" ||
            !snapshot.success ||
            !snapshot.meta?.revision
          )
            break;
          baseRevision = String(snapshot.meta.revision);
        } else if (
          capabilities.some(
            (capability) =>
              capability.kind === "edit" &&
              capability.path === requirement.path,
          )
        ) {
          baseRevision = spec.fileSession
            .snapshot()
            .artifacts.get(requirement.path)?.revision;
        }
        if (!baseRevision) break;
        args = {
          path: requirement.path,
          baseRevision,
          oldText: requirement.reference,
          newText: requirement.replacement,
        };
        result = await runtime.execute({
          kind: "edit",
          path: requirement.path,
          baseRevision,
          oldText: requirement.reference,
          newText: requirement.replacement,
        });
      } else if (
        !requirement &&
        runtimeTools()[0]?.function.name === PAGE_TOOL.verify
      ) {
        toolName = PAGE_TOOL.verify;
        result = await runtime.execute({ kind: "verify" });
      } else {
        break;
      }

      deterministicRecoveries += 1;
      spec.onEvent?.({
        kind: "tool",
        name: toolName,
        args,
        iteration: iterationsUsed + recovery,
        result: result ?? {
          success: false,
          error: "deterministic recovery produced no result",
        },
        ...pageToolActivity(toolName, args),
      });
      if (typeof result !== "string" && !result?.success) break;
      const after = runtime.plan().decision;
      if (JSON.stringify(after) === JSON.stringify(before)) break;
    }
  }

  return {
    content,
    toolCalls,
    iterationsUsed,
    emptyStopRecoveries,
    finalDecision:
      spec.explicitCompletion && completedByAgent
        ? { kind: "complete" }
        : runtime.plan().decision,
    finalRequirement: runtime.plan().finding?.blocking
      ? spec.assetLifecycle
          ?.inspect(spec.fileSession.snapshot().artifacts)
          .find((requirement) => requirement.kind === "asset_reference")
      : undefined,
    finalLegalTools: runtimeTools().map((tool) => tool.function.name),
    deterministicRecoveries,
  };
}
