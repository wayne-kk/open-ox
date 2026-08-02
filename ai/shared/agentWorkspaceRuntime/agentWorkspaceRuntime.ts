import type { ToolResult } from "@/ai/tools";
import type {
  FileSession,
  FileSessionArtifact,
  FileSessionCall,
  FileSessionEvent,
  FileSessionSnapshot,
} from "@/ai/shared/fileSession/fileSession";

export interface AgentWorkspaceFinding {
  code: string;
  message: string;
  path?: string;
  blocking: boolean;
  resolution?: { kind: "external"; capability: string } | { kind: "edit"; path: string };
}

export interface AgentWorkspaceProfile {
  projection?: {
    label: string;
    goal: string;
    targetPaths: readonly string[];
    ownership: string;
  };
  primaryArtifact?: {
    path: string;
    requireSessionWriteWhenInvalid?: boolean;
    /** Allow owned supporting artifacts to be created before the primary artifact. */
    allowSupportingArtifactsBeforePrimary?: boolean;
    isValid(content: string): boolean;
  };
  /** Keep editing capabilities open after file validity for agent-driven refactoring. */
  explicitCompletion?: boolean;
  inspectFindings(artifacts: ReadonlyMap<string, FileSessionArtifact>): readonly AgentWorkspaceFinding[];
}

export type AgentWorkspaceCapability =
  | { kind: "create_primary"; path: string }
  | { kind: "create" }
  | { kind: "read"; path?: string }
  | { kind: "edit"; path?: string }
  | { kind: "verify" }
  | { kind: "external"; capability: string };

export type AgentWorkspaceIntent =
  | { kind: "create"; path: string; content: string }
  | { kind: "read"; path: string }
  | {
      kind: "edit";
      path: string;
      baseRevision: string;
      oldText: string;
      newText: string;
    }
  | { kind: "verify"; paths?: string[] }
  | { kind: "external"; capability: string; args: Record<string, unknown> };

export interface AgentWorkspacePlan {
  decision: { kind: "continue"; reason: string } | { kind: "complete" } | { kind: "failed"; error: string };
  capabilities: readonly AgentWorkspaceCapability[];
  finding?: AgentWorkspaceFinding;
}

export interface AgentWorkspaceRuntime {
  initialize(): Promise<void>;
  plan(): AgentWorkspacePlan;
  project(): AgentWorkspaceProjection;
  execute(intent: AgentWorkspaceIntent): Promise<ToolResult | string>;
}

export interface AgentWorkspaceProjection {
  plan: AgentWorkspacePlan;
  artifacts: readonly { path: string; revision: string }[];
  writtenPaths: readonly string[];
  diagnostics: readonly { path: string; message: string }[];
  mutations: readonly {
    path: string;
    operation: "file_created" | "file_updated";
    revision?: string;
  }[];
  contextCard: string;
  taskState: {
    goal: string;
    targetPaths: readonly string[];
    mutations: readonly {
      path: string;
      operation: "file_created" | "file_updated";
      revision?: string;
      outcome: "success";
    }[];
    unresolvedDiagnostics: readonly { path: string; summary: string }[];
    decisions: readonly string[];
  };
}

type ExternalAction = (args: Record<string, unknown>) => Promise<ToolResult | string>;

type PendingPrerequisite =
  | { kind: "none" }
  | { kind: "read_required"; path: string }
  | { kind: "edit_ready"; path: string };

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
          code: event.code,
          retryable: event.retryable,
          eventKind: event.kind,
        },
      };
}

function exactTextEdits(content: string, oldText: string, newText: string) {
  if (!oldText) return [];
  const offsets: number[] = [];
  for (
    let offset = content.indexOf(oldText);
    offset >= 0;
    offset = content.indexOf(oldText, offset + oldText.length)
  ) {
    offsets.push(offset);
  }
  const position = (offset: number) => {
    const lines = content.slice(0, offset).split("\n");
    return { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 };
  };
  return offsets.map((offset) => ({
    range: { start: position(offset), end: position(offset + oldText.length) },
    newText,
  }));
}

export function createAgentWorkspaceRuntime(options: {
  fileSession: FileSession;
  profile: AgentWorkspaceProfile;
  externalActions?: Record<string, ExternalAction>;
}): AgentWorkspaceRuntime {
  const { fileSession, profile } = options;
  const externalActions = options.externalActions ?? {};
  let prerequisite: PendingPrerequisite = { kind: "none" };
  let externalMutationNeedsVerification = false;

  const executeFile = async (call: FileSessionCall): Promise<ToolResult> =>
    eventResult(await fileSession.execute(call));

  const findingPlan = (
    finding: AgentWorkspaceFinding,
    workspace: FileSessionSnapshot,
  ): AgentWorkspacePlan | null => {
    if (!finding.blocking) return null;
    if (!finding.resolution) {
      return {
        decision: {
          kind: "failed",
          error: `UNRESOLVABLE_FINDING: ${finding.code}: ${finding.message}`,
        },
        capabilities: [],
        finding,
      };
    }
    if (finding.resolution.kind === "external") {
      if (!externalActions[finding.resolution.capability]) {
        return {
          decision: {
            kind: "failed",
            error: `MISSING_CAPABILITY: ${finding.resolution.capability}`,
          },
          capabilities: [],
          finding,
        };
      }
      return {
        decision: { kind: "continue", reason: finding.message },
        capabilities: [
          {
            kind: "external",
            capability: finding.resolution.capability,
          },
        ],
        finding,
      };
    }
    const path = finding.resolution.path;
    if (!fileSession.ownsPath(path) || !workspace.artifacts.has(path)) {
      return {
        decision: {
          kind: "failed",
          error: `UNRESOLVABLE_EDIT_FINDING: ${finding.code}: ${path} is not an owned, loaded artifact`,
        },
        capabilities: [],
        finding,
      };
    }
    return {
      decision: { kind: "continue", reason: finding.message },
      capabilities:
        workspace.access.get(path) === "edit_ready" ? [{ kind: "edit", path }] : [{ kind: "read", path }],
      finding,
    };
  };

  const planFromSnapshot = (workspace: FileSessionSnapshot): AgentWorkspacePlan => {
    const fileDecision = workspace.decision;
    if (fileDecision.kind === "failed") {
      return { decision: fileDecision, capabilities: [] };
    }

    const primary = profile.primaryArtifact;
    if (
      primary?.requireSessionWriteWhenInvalid &&
      workspace.artifacts.has(primary.path) &&
      !primary.isValid(workspace.artifacts.get(primary.path)!.content) &&
      !workspace.writtenPaths.includes(primary.path) &&
      !primary.allowSupportingArtifactsBeforePrimary
    ) {
      return {
        decision: fileDecision,
        capabilities: [{ kind: "create_primary", path: primary.path }],
      };
    }
    if (primary && !workspace.artifacts.has(primary.path) && !primary.allowSupportingArtifactsBeforePrimary) {
      return {
        decision:
          fileDecision.kind === "complete"
            ? { kind: "continue", reason: `${primary.path} is missing` }
            : fileDecision,
        capabilities: [{ kind: "create_primary", path: primary.path }],
      };
    }

    if (workspace.prerequisite?.kind === "read_required") {
      return {
        decision:
          fileDecision.kind === "complete"
            ? {
                kind: "continue",
                reason: `${prerequisite.kind === "read_required" ? prerequisite.path : "file"} needs a fresh snapshot`,
              }
            : fileDecision,
        capabilities: [
          {
            kind: "read",
            ...(prerequisite.kind === "read_required"
              ? { path: prerequisite.path }
              : { path: workspace.prerequisite.path }),
          },
        ],
      };
    }

    if (prerequisite.kind === "edit_ready") {
      return {
        decision: {
          kind: "continue",
          reason: `${prerequisite.path} is ready for editing`,
        },
        capabilities: [{ kind: "edit", path: prerequisite.path }],
      };
    }

    const diagnostic = workspace.diagnostics[0];
    if (diagnostic && fileSession.ownsPath(diagnostic.path) && workspace.artifacts.has(diagnostic.path)) {
      return {
        decision: { kind: "continue", reason: diagnostic.message },
        capabilities:
          workspace.access.get(diagnostic.path) === "edit_ready"
            ? [{ kind: "edit", path: diagnostic.path }]
            : [{ kind: "read", path: diagnostic.path }],
      };
    }

    for (const finding of profile.inspectFindings(workspace.artifacts)) {
      const findingResult = findingPlan(finding, workspace);
      if (findingResult) return findingResult;
    }

    if (primary && !workspace.artifacts.has(primary.path)) {
      return {
        decision:
          fileDecision.kind === "complete"
            ? { kind: "continue", reason: `${primary.path} is missing` }
            : fileDecision,
        capabilities: [
          { kind: "create" },
          { kind: "create_primary", path: primary.path },
          ...(workspace.needsVerification ? [{ kind: "verify" } as const] : []),
        ],
      };
    }

    if (fileDecision.kind === "complete" && profile.explicitCompletion) {
      return {
        decision: {
          kind: "continue",
          reason: "workspace is valid; awaiting explicit completion",
        },
        capabilities: [
          { kind: "create" },
          { kind: "read" },
          { kind: "edit" },
          { kind: "verify" },
          ...Object.keys(externalActions).map(
            (capability): AgentWorkspaceCapability => ({
              kind: "external",
              capability,
            }),
          ),
        ],
      };
    }

    if (
      fileDecision.kind === "complete" &&
      (workspace.needsVerification || externalMutationNeedsVerification)
    ) {
      return {
        decision: {
          kind: "continue",
          reason: "current workspace revision needs verification",
        },
        capabilities: [{ kind: "verify" }],
      };
    }
    if (fileDecision.kind === "complete") {
      return { decision: fileDecision, capabilities: [] };
    }

    return {
      decision: fileDecision,
      capabilities: [
        { kind: "create" },
        { kind: "read" },
        { kind: "edit" },
        { kind: "verify" },
        ...Object.keys(externalActions).map(
          (capability): AgentWorkspaceCapability => ({
            kind: "external",
            capability,
          }),
        ),
      ],
    };
  };
  const plan = (): AgentWorkspacePlan => planFromSnapshot(fileSession.snapshot());

  const illegalIntent = (intent: AgentWorkspaceIntent): ToolResult => ({
    success: false,
    error: `ILLEGAL_CAPABILITY: ${intent.kind} is not legal in the current workspace state`,
    meta: { code: "ILLEGAL_CAPABILITY", retryable: true },
  });

  return {
    initialize: async () => {
      if (profile.primaryArtifact) {
        await fileSession.loadIfExists(profile.primaryArtifact.path);
      }
    },
    plan,
    project: () => {
      const workspace = fileSession.snapshot();
      const currentPlan = planFromSnapshot(workspace);
      const projection = profile.projection ?? {
        label: "Workspace state",
        goal: "Complete the assigned workspace task",
        targetPaths: profile.primaryArtifact ? [profile.primaryArtifact.path] : [],
        ownership: "configured workspace paths",
      };
      const capabilities = currentPlan.capabilities.map((capability) =>
        capability.kind === "external" ? capability.capability : capability.kind,
      );
      const decisions = [
        `ownership=${projection.ownership}`,
        `next=${
          currentPlan.decision.kind === "continue" ? currentPlan.decision.reason : currentPlan.decision.kind
        }`,
        ...(currentPlan.finding ? [`finding=${JSON.stringify(currentPlan.finding)}`] : []),
      ];
      return {
        plan: currentPlan,
        artifacts: [...workspace.artifacts.entries()].map(([path, artifact]) => ({
          path,
          revision: artifact.revision,
        })),
        writtenPaths: workspace.writtenPaths,
        diagnostics: workspace.diagnostics.map(({ path, message }) => ({
          path,
          message,
        })),
        mutations: workspace.mutations,
        contextCard: [
          `[${projection.label}]`,
          `target: ${projection.targetPaths.join(", ") || "none"}`,
          `written_paths: ${workspace.writtenPaths.join(", ") || "none"}`,
          `next: ${
            currentPlan.decision.kind === "continue" ? currentPlan.decision.reason : currentPlan.decision.kind
          }`,
          `blocking_finding: ${currentPlan.finding ? JSON.stringify(currentPlan.finding) : "none"}`,
          `legal_capabilities: ${capabilities.join(", ") || "none"}`,
          `ownership: ${projection.ownership}`,
        ].join("\n"),
        taskState: {
          goal: projection.goal,
          targetPaths: projection.targetPaths,
          mutations: workspace.mutations.map((mutation) => ({
            ...mutation,
            outcome: "success" as const,
          })),
          unresolvedDiagnostics: workspace.diagnostics.map(({ path, message }) => ({
            path,
            summary: message,
          })),
          decisions,
        },
      };
    },
    execute: async (intent) => {
      const currentPlan = plan();
      const legal = currentPlan.capabilities.some((capability) => {
        if (intent.kind === "create") {
          return (
            capability.kind === "create" ||
            (capability.kind === "create_primary" && capability.path === intent.path)
          );
        }
        if (intent.kind === "external") {
          return capability.kind === "external" && capability.capability === intent.capability;
        }
        if (capability.kind !== intent.kind) return false;
        return (
          !("path" in capability) ||
          !capability.path ||
          !("path" in intent) ||
          capability.path === intent.path
        );
      });
      if (!legal) return illegalIntent(intent);

      if (intent.kind === "create") {
        const isPrimaryCreate = currentPlan.capabilities.some(
          (capability) => capability.kind === "create_primary" && capability.path === intent.path,
        );
        if (!isPrimaryCreate && (await fileSession.loadIfExists(intent.path))) {
          const snapshot = await executeFile({
            name: "read_file_snapshot",
            args: { path: intent.path },
          });
          if (snapshot.success) prerequisite = { kind: "edit_ready", path: intent.path };
          return {
            ...snapshot,
            output: `${intent.path} already exists. Creation was not executed; edit the returned snapshot.`,
            meta: {
              ...snapshot.meta,
              code: "EXISTING_ARTIFACT",
              transition: "editable",
            },
          };
        }
        return executeFile({
          name: "create_file",
          args: { path: intent.path, content: intent.content },
        });
      }
      if (intent.kind === "read") {
        const result = await executeFile({
          name: "read_file_snapshot",
          args: { path: intent.path },
        });
        if (result.success && prerequisite.kind === "read_required" && prerequisite.path === intent.path) {
          prerequisite = { kind: "edit_ready", path: intent.path };
        }
        return result;
      }
      if (intent.kind === "edit") {
        const edits = exactTextEdits(
          fileSession.snapshot().artifacts.get(intent.path)?.content ?? "",
          intent.oldText,
          intent.newText,
        );
        if (edits.length === 0) {
          return {
            success: false,
            error: `EDIT_TEXT_NOT_FOUND: ${intent.oldText}`,
            meta: {
              path: intent.path,
              code: "EDIT_TEXT_NOT_FOUND",
              retryable: true,
            },
          };
        }
        const result = await executeFile({
          name: "apply_file_patch",
          args: { path: intent.path, baseRevision: intent.baseRevision, edits },
        });
        if (!result.success && result.meta?.code === "STALE_REVISION") {
          prerequisite = { kind: "read_required", path: intent.path };
        }
        if (result.success && prerequisite.kind === "edit_ready" && prerequisite.path === intent.path) {
          prerequisite = { kind: "none" };
        }
        return result;
      }
      if (intent.kind === "verify") {
        const result = await executeFile({
          name: "verify_files",
          args: { paths: intent.paths },
        });
        if (result.success) externalMutationNeedsVerification = false;
        return result;
      }
      const external = externalActions[intent.capability];
      if (!external) return illegalIntent(intent);
      const result = await external(intent.args);
      if (typeof result === "string" || result.success) {
        externalMutationNeedsVerification = true;
      }
      return result;
    },
  };
}
