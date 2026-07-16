/**
 * Langfuse **trace** and **span** observation names (tree view in Langfuse UI).
 *
 * Convention:
 *   `ox.trace.<flow>` — root trace (one per HTTP / logical run)
 *   `ox.span.<area>.<ordered_step>_<slug>` — spans; numeric prefix keeps siblings sorted
 *     in pipeline order in the Langfuse tree.
 *
 * Generation **generation** names stay in {@link ./langfuseGenerationCatalog}; this file
 * is only for traces and spans.
 */
export const OX_TRACE_PREFIX = "ox.trace" as const;
export const OX_SPAN_PREFIX = "ox.span" as const;

/** Root traces — use for {@link runWithLangfuseTraceRoot}'s `name`. */
export const LfTrace = {
  /**
   * Full build pipeline (intent commit + generate, or standalone generate).
   * Clarification-only turns stay on {@link LfTrace.intentAgent}; modify uses
   * {@link LfTrace.modifyProject}.
   */
  projectBuild: `${OX_TRACE_PREFIX}.project_build`,
  /**
   * @deprecated Prefer {@link LfTrace.projectBuild}. Kept so older traces remain findable by name.
   */
  generateProject: `${OX_TRACE_PREFIX}.generate_project`,
  intentAgent: `${OX_TRACE_PREFIX}.intent_agent`,
  modifyProject: `${OX_TRACE_PREFIX}.modify_project`,
} as const;

/** Spans inside {@link LfTrace.projectBuild} (and nested under intent commit continuation). */
export const LfSpanGen = {
  /** Wraps the full generate inner pipeline when a parent trace already exists. */
  fullPipeline: `${OX_SPAN_PREFIX}.gen.00_full_pipeline`,
  intentGuide: `${OX_SPAN_PREFIX}.gen.01_intent_guide`,
  researchReferenceSites: `${OX_SPAN_PREFIX}.gen.01b_research_reference_sites`,
  analyzeBlueprintParallel: `${OX_SPAN_PREFIX}.gen.02_analyze_blueprint_parallel`,
  planAndDesignSystem: `${OX_SPAN_PREFIX}.gen.03_plan_and_design_system`,
  applyDesignTokens: `${OX_SPAN_PREFIX}.gen.04_apply_design_tokens`,
  architectScaffoldAgent: `${OX_SPAN_PREFIX}.gen.05_architect_scaffold_agent`,
  implementPages: `${OX_SPAN_PREFIX}.gen.06_implement_pages`,
  chromeOptimizeAgent: `${OX_SPAN_PREFIX}.gen.07_chrome_optimize_agent`,
  installDependenciesAfterImplement: `${OX_SPAN_PREFIX}.gen.08_install_dependencies_post_pages`,
  typescriptRepair: `${OX_SPAN_PREFIX}.gen.09_typescript_repair`,
  buildVerifyAndRepair: `${OX_SPAN_PREFIX}.gen.10_build_verify_and_repair`,
  /** @deprecated Renamed to architectScaffoldAgent */
  architectAgent: `${OX_SPAN_PREFIX}.gen.05_architect_scaffold_agent`,
} as const;

/** Per-page parallel branch under implement pages. */
export function lfSpanGenPage(slug: string): string {
  const safe = slug.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "page";
  return `${OX_SPAN_PREFIX}.gen.06b_page__${safe}`;
}

/** Scoped install-deps (e.g. template vs generated). */
export function lfSpanGenInstallDeps(scope: string): string {
  const safe = scope.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "default";
  return `${OX_SPAN_PREFIX}.gen.08a_install_deps__${safe}`;
}

/** Spans for {@link LfTrace.intentAgent}. */
export const LfSpanIntent = {
  agentTurn: `${OX_SPAN_PREFIX}.intent.01_agent_turn`,
  /** Commit path: wraps {@link runGenerateProject} so generations nest under one subtree. */
  mergedBriefGeneration: `${OX_SPAN_PREFIX}.intent.02_merged_brief_generation`,
} as const;

/** Spans for {@link LfTrace.modifyProject}. */
export const LfSpanModify = {
  intentRouter: `${OX_SPAN_PREFIX}.modify.01_intent_router`,
  agentLoop: `${OX_SPAN_PREFIX}.modify.02_agent_loop`,
  completionSummary: `${OX_SPAN_PREFIX}.modify.03_completion_summary`,
} as const;
