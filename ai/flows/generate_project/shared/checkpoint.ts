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

// ── Step completion validators ───────────────────────────────────────────────

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

/** Validators for each resumable step */
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

    preselect_skills: (ctx) => {
        return stepCompleted(ctx.buildSteps, "preselect_skills");
    },
};

/**
 * Check if a specific generate_section step completed successfully.
 * Section steps are named "generate_section:{scope}:{fileName}".
 */
function isSectionGenerated(ctx: CheckpointContext, scopeKey: string, fileName: string): boolean {
    const stepName = `generate_section:${scopeKey}:${fileName}`;
    if (!stepCompleted(ctx.buildSteps, stepName)) return false;
    // Verify the TSX file actually exists on disk
    const filePath = scopeKey === "layout"
        ? `components/sections/layout_${fileName}`
        : `components/sections/${scopeKey}_${fileName}`;
    return siteFileExists(ctx.siteRoot, filePath);
}

/**
 * Check if a compose_page step completed.
 */
function isPageComposed(ctx: CheckpointContext, slug: string): boolean {
    const stepName = `compose_page:${slug}`;
    if (!stepCompleted(ctx.buildSteps, stepName)) return false;
    const pagePath = slug === "home" ? "app/page.tsx" : `app/${slug}/page.tsx`;
    return siteFileExists(ctx.siteRoot, pagePath);
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface CheckpointResult {
    /** Which pipeline steps can be skipped */
    skipAnalyze: boolean;
    skipPlanAndDesign: boolean;
    skipDesignTokens: boolean;
    /** Per-section skip map: "scope:fileName" → true if already generated */
    generatedSections: Set<string>;
    /** Per-page skip map: slug → true if already composed */
    composedPages: Set<string>;
    /** The blueprint from DB (if analyze was already done) */
    cachedBlueprint: PlannedProjectBlueprint | null;
    /** The design system content from disk (if already generated) */
    cachedDesignSystem: string | null;
    /** Whether any checkpoint was found at all */
    hasCheckpoint: boolean;
    /** Human-readable summary of what's being resumed */
    summary: string;
}

/**
 * Detect which steps have already completed for a project.
 * Returns a CheckpointResult describing what can be skipped.
 */
export function detectCheckpoint(project: ProjectMetadata): CheckpointResult {
    const siteRoot = join(process.cwd(), "sites", project.id);
    const buildSteps = (project.buildSteps ?? []) as BuildStep[];
    const ctx: CheckpointContext = { project, siteRoot, buildSteps };

    const result: CheckpointResult = {
        skipAnalyze: false,
        skipPlanAndDesign: false,
        skipDesignTokens: false,
        generatedSections: new Set(),
        composedPages: new Set(),
        cachedBlueprint: null,
        cachedDesignSystem: null,
        hasCheckpoint: false,
        summary: "",
    };

    // Check steps in pipeline order — stop at first incomplete step
    if (!STEP_VALIDATORS.analyze_project_requirement(ctx)) {
        return result;
    }
    result.skipAnalyze = true;
    result.hasCheckpoint = true;
    result.cachedBlueprint = project.blueprint as PlannedProjectBlueprint;

    // plan_project and generate_project_design_system are parallel — both must be done
    const planDone = STEP_VALIDATORS.plan_project(ctx);
    const designDone = STEP_VALIDATORS.generate_project_design_system(ctx);
    if (!planDone || !designDone) {
        result.summary = "Resuming from plan_project / design_system";
        return result;
    }
    result.skipPlanAndDesign = true;

    // Read cached design system from disk
    const dsPath = join(siteRoot, "design-system.md");
    if (existsSync(dsPath)) {
        result.cachedDesignSystem = readFileSync(dsPath, "utf-8");
    }

    if (!STEP_VALIDATORS.apply_project_design_tokens(ctx)) {
        result.summary = "Resuming from apply_project_design_tokens";
        return result;
    }
    result.skipDesignTokens = true;

    if (!STEP_VALIDATORS.preselect_skills(ctx)) {
        result.summary = "Resuming from preselect_skills";
        return result;
    }
    result.skipDesignTokens = true;

    // Check individual sections
    const bp = result.cachedBlueprint;
    if (bp) {
        for (const section of bp.site.layoutSections) {
            if (isSectionGenerated(ctx, "layout", section.fileName)) {
                result.generatedSections.add(`layout:${section.fileName}`);
            }
        }
        for (const page of bp.site.pages) {
            for (const section of page.sections) {
                if (isSectionGenerated(ctx, page.slug, section.fileName)) {
                    result.generatedSections.add(`${page.slug}:${section.fileName}`);
                }
            }
            if (isPageComposed(ctx, page.slug)) {
                result.composedPages.add(page.slug);
            }
        }
    }

    const skippedCount = result.generatedSections.size + result.composedPages.size;
    result.summary = skippedCount > 0
        ? `Resuming: skipping ${result.generatedSections.size} sections, ${result.composedPages.size} pages`
        : "Resuming from section generation";

    return result;
}
