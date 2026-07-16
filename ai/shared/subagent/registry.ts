import { exploreSubagentSpec } from "./kinds/explore";
import { researchSubagentSpec } from "./kinds/research";
import { verifierSubagentSpec } from "./kinds/verifier";
import type { SubagentKind, SubagentSpec } from "./types";

const specs = new Map<SubagentKind, SubagentSpec>();

function ensureBuiltinsRegistered(): void {
  if (specs.size > 0) return;
  specs.set(exploreSubagentSpec.kind, exploreSubagentSpec);
  specs.set(verifierSubagentSpec.kind, verifierSubagentSpec);
  specs.set(researchSubagentSpec.kind, researchSubagentSpec);
}

/** Register or replace a subagent spec (tests / future custom kinds). */
export function registerSubagent(spec: SubagentSpec): void {
  ensureBuiltinsRegistered();
  specs.set(spec.kind, spec);
}

export function getSubagentSpec(kind: SubagentKind): SubagentSpec {
  ensureBuiltinsRegistered();
  const spec = specs.get(kind);
  if (!spec) {
    throw new Error(`Unknown subagent kind: ${kind}`);
  }
  return spec;
}

export function listSubagentKinds(): SubagentKind[] {
  ensureBuiltinsRegistered();
  return [...specs.keys()];
}

/** Test helper — clears custom registrations and restores builtins. */
export function resetSubagentRegistryForTests(): void {
  specs.clear();
  ensureBuiltinsRegistered();
}
