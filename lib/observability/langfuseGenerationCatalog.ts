/**
 * Single source of truth for Langfuse **generation** names (the `name` field on observations).
 *
 * Convention:
 *   `ox.gen.plain.<semantic_step>` — single-shot chat completions (no tool loop)
 *   `ox.gen.tool_agent.<phase>.round_<n>` — nth model turn inside a tool-using agent
 *
 * `<semantic_step>` and `<phase>` describe **what the call is for**, not file names.
 * Use only [a-z0-9_] in segments after `ox.gen.` for stable filtering in Langfuse.
 */
export const OXGEN_PREFIX = "ox.gen" as const;

/** One-shot LLM calls (maps to pipeline intent). */
export const LfPlain = {
  applyDesignTokens: "apply_design_tokens_to_globals_css",
  projectIntentGuide: "project_intent_guide_dialogue",
  modifyIntentRouter: "modify_intent_router_classify",
  inferDesignIntent: "infer_design_intent_and_keywords",
  analyzeRequirement: "analyze_requirement_blueprint_json",
  planProject: "expand_site_blueprint_and_sections",
  matchDesignSystemSkill: "match_builtin_design_system_skill",
  generateDesignSystemMd: "author_design_system_markdown",
  heroComponentSkillPick: "pick_hero_section_component_skill",
  /** Default only when a call site forgot to pass a name (should not happen in production paths). */
  unspecified: "plain_unspecified",
} as const;

export type LfPlainKind = (typeof LfPlain)[keyof typeof LfPlain];

export function lfPlain(kind: string): string {
  const safe = kind.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
  return `${OXGEN_PREFIX}.plain.${safe}`;
}

/**
 * Tool-loop agents: one entry per model round (iteration is 0-based from the loop).
 */
export function lfToolAgentRound(phaseSlug: string, iterationZeroBased: number): string {
  const safe =
    phaseSlug.replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "agent";
  const n = iterationZeroBased + 1;
  return `${OXGEN_PREFIX}.tool_agent.${safe}.round_${n}`;
}

/** e.g. `page__home` — use inside lfToolAgentRound for per-page agents */
export function lfPageImplementPhaseSlug(pageSlug: string): string {
  const s = pageSlug.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "page";
  return `page__${s}`;
}

export const LfToolPhase = {
  analyzeRequirement: "analyze_requirement",
  intentAgent: "intent_agent",
  architect: "architect_layout_and_chrome",
  repairBuild: "repair_build_after_failure",
  installDeps: "install_third_party_dependencies",
} as const;

export function lfModifyAgentRound(outerIteration: number, httpAttempt: number): string {
  return `${OXGEN_PREFIX}.modify_agent.iteration_${outerIteration}.http_attempt_${httpAttempt}`;
}
