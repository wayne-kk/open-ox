/**
 * Checkpoint Resume — detect completed steps and skip them on retry/resume.
 *
 * Each step has a validator that checks whether its artifacts are present and valid.
 * The pipeline calls `detectCheckpoint()` at startup to determine which steps to skip.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ProjectMetadata } from "@/lib/projectManager";
import type { PlannedProjectBlueprint, BuildStep } from "../types";

type StepValidator = (ctx: CheckpointContext) => boolean;

interface CheckpointContext {
  project: ProjectMetadata;
  siteRoot: string;
  buildSteps: BuildStep[];
}

function stepCompleted(steps: BuildStep[], stepName: string): boolean {
  return steps.some((s) => s.step === stepName && s.status === "ok");
}

function siteFileExists(siteRoot: string, relativePath: string, minBytes = 1): boolean {
  const fullPath = join(siteRoot, relativePath);
  if (!existsSync(fullPath)) return false;
  if (minBytes <= 1) return true;
  try {
    const content = readFileSync(fullPath, "utf-8");
    return content.length >= minBytes;
  } catch {
    return false;
  }
}

function pageRoutePath(slug: string): string {
  return slug === "home" ? "app/page.tsx" : `app/${slug}/page.tsx`;
}

/** Page implementation is done when the route file exists and `page_implement_agent` logged ok. */
function isPageImplementAgentDone(ctx: CheckpointContext, slug: string): boolean {
  if (!siteFileExists(ctx.siteRoot, pageRoutePath(slug), 10)) return false;
  return stepCompleted(ctx.buildSteps, `page_implement_agent:${slug}`);
}

const STEP_VALIDATORS: Record<string, StepValidator> = {
  analyze_project_requirement: (ctx) => {
    if (!stepCompleted(ctx.buildSteps, "analyze_project_requirement")) return false;
    const bp = ctx.project.blueprint as PlannedProjectBlueprint | undefined;
    return !!(bp?.brief?.projectTitle && bp?.site?.pages?.length > 0);
  },

  plan_project: (ctx) => {
    if (!stepCompleted(ctx.buildSteps, "plan_project")) return false;
    const bp = ctx.project.blueprint as PlannedProjectBlueprint | undefined;
    return (bp?.site?.pages?.length ?? 0) > 0;
  },

  generate_project_design_system: (ctx) => {
    if (!stepCompleted(ctx.buildSteps, "generate_project_design_system")) return false;
    return siteFileExists(ctx.siteRoot, "design-system.md", 200);
  },

  apply_project_design_tokens: (ctx) => {
    if (!stepCompleted(ctx.buildSteps, "apply_project_design_tokens")) return false;
    return siteFileExists(ctx.siteRoot, "app/globals.css", 100);
  },

  architect_agent: (ctx) => {
    if (!stepCompleted(ctx.buildSteps, "architect_agent")) return false;
    return siteFileExists(ctx.siteRoot, "app/layout.tsx", 50);
  },
};

export interface CheckpointResult {
  skipAnalyze: boolean;
  skipPlanAndDesign: boolean;
  skipDesignTokens: boolean;
  skipArchitect: boolean;
  /** Page slugs whose `page_implement_agent` step already completed successfully. */
  implementedPages: Set<string>;
  cachedBlueprint: PlannedProjectBlueprint | null;
  cachedDesignSystem: string | null;
  hasCheckpoint: boolean;
  summary: string;
}

export function detectCheckpoint(project: ProjectMetadata): CheckpointResult {
  const siteRoot = join(process.cwd(), "sites", project.id);
  const buildSteps = (project.buildSteps ?? []) as BuildStep[];
  const ctx: CheckpointContext = { project, siteRoot, buildSteps };

  const result: CheckpointResult = {
    skipAnalyze: false,
    skipPlanAndDesign: false,
    skipDesignTokens: false,
    skipArchitect: false,
    implementedPages: new Set(),
    cachedBlueprint: null,
    cachedDesignSystem: null,
    hasCheckpoint: false,
    summary: "",
  };

  if (!STEP_VALIDATORS.analyze_project_requirement(ctx)) {
    return result;
  }
  result.skipAnalyze = true;
  result.hasCheckpoint = true;
  result.cachedBlueprint = project.blueprint as PlannedProjectBlueprint;

  const planDone = STEP_VALIDATORS.plan_project(ctx);
  const designDone = STEP_VALIDATORS.generate_project_design_system(ctx);
  if (!planDone || !designDone) {
    result.summary = "Resuming from plan_project / design_system";
    return result;
  }
  result.skipPlanAndDesign = true;

  const dsPath = join(siteRoot, "design-system.md");
  if (existsSync(dsPath)) {
    result.cachedDesignSystem = readFileSync(dsPath, "utf-8");
  }

  if (!STEP_VALIDATORS.apply_project_design_tokens(ctx)) {
    result.summary = "Resuming from apply_project_design_tokens";
    return result;
  }
  result.skipDesignTokens = true;

  if (STEP_VALIDATORS.architect_agent(ctx)) {
    result.skipArchitect = true;
  }

  const bp = result.cachedBlueprint;
  if (bp) {
    for (const page of bp.site.pages) {
      if (isPageImplementAgentDone(ctx, page.slug)) {
        result.implementedPages.add(page.slug);
      }
    }
  }

  result.summary =
    result.implementedPages.size > 0
      ? `Resuming: skipping ${result.implementedPages.size} implemented page(s)`
      : "Resuming from page implementation";

  return result;
}
