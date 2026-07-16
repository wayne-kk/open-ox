import type { ModelId } from "@/lib/config/models";
import { MODIFY_COMPLEX_MODEL, MODIFY_DEFAULT_MODEL } from "@/lib/config/models";
import type { ModifyIntentCategory, ModifyIntentRouterResult } from "../intent/modifyIntentRouter";

export type ModifyScope = "style" | "narrow" | "broad";

export type ModifyVerificationMode = "none" | "tsc_only" | "tsc_then_build_if_needed";

export interface ModifyProfile {
  category: ModifyIntentCategory;
  scope: ModifyScope;
  /** When false, agent is read-only (Q&A). */
  allowEdits: boolean;
  verificationMode: ModifyVerificationMode;
  allowWriteFile: boolean;
  maxIterations: number;
  modelId: ModelId;
  usePlannedWideFlow: boolean;
  /** Set by the plan phase (LLM) — optional soft constraint on edit paths. */
  allowedTargetFiles?: string[];
}

/**
 * Map LLM intent-router output to execution profile. Category first — no keyword heuristics.
 */
export function resolveModifyProfile(routed: ModifyIntentRouterResult): ModifyProfile {
  if (routed.category === "read_only") {
    return {
      category: "read_only",
      scope: "narrow",
      allowEdits: false,
      verificationMode: "none",
      allowWriteFile: false,
      maxIterations: 22,
      modelId: MODIFY_DEFAULT_MODEL,
      usePlannedWideFlow: false,
    };
  }

  const scope = routed.scope;

  if (scope === "style") {
    return {
      category: "code_change",
      scope: "style",
      allowEdits: true,
      verificationMode: "tsc_only",
      allowWriteFile: false,
      maxIterations: 14,
      modelId: MODIFY_DEFAULT_MODEL,
      usePlannedWideFlow: false,
    };
  }

  if (scope === "broad") {
    return {
      category: "code_change",
      scope: "broad",
      allowEdits: true,
      verificationMode: "tsc_then_build_if_needed",
      allowWriteFile: false,
      maxIterations: 12,
      modelId: MODIFY_COMPLEX_MODEL,
      usePlannedWideFlow: true,
    };
  }

  return {
    category: "code_change",
    scope: "narrow",
    allowEdits: true,
    verificationMode: "tsc_then_build_if_needed",
    allowWriteFile: true,
    maxIterations: 28,
    modelId: MODIFY_DEFAULT_MODEL,
    usePlannedWideFlow: false,
  };
}

const READ_ONLY_TOOLS = [
  "read_file",
  "search_code",
  "list_dir",
  "think",
  "spawn_subagent",
] as const;

const EDIT_TOOLS = [
  "read_file",
  "search_code",
  "list_dir",
  "edit_file",
  "think",
  "revert_file",
  "run_scoped_tsc",
  "spawn_subagent",
] as const;

export function toolNamesForProfile(
  profile: ModifyProfile,
  options?: { includeImageTools?: boolean }
): string[] {
  if (!profile.allowEdits) {
    return [...READ_ONLY_TOOLS];
  }

  const names: string[] = [...EDIT_TOOLS];
  if (profile.allowWriteFile) {
    names.push("write_file");
  }
  if (options?.includeImageTools) {
    names.push("generate_image");
  }
  return names;
}

export function withAllowedTargets(profile: ModifyProfile, targets: string[]): ModifyProfile {
  const normalized = targets.map((t) => t.replace(/\\/g, "/").replace(/^(\.\/)+/, ""));
  return { ...profile, allowedTargetFiles: normalized };
}

/** Only enforces plan targets when the plan phase produced a file list. */
export function assertModifyPathAllowed(profile: ModifyProfile, relativePath: string): string | null {
  if (!profile.allowedTargetFiles?.length) return null;
  const norm = relativePath.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
  if (!profile.allowedTargetFiles.includes(norm)) {
    return `Path "${norm}" is not in the approved plan targets: ${profile.allowedTargetFiles.join(", ")}`;
  }
  return null;
}
