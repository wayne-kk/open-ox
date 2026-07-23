/**
 * Generation effort tiers — map Fast/Balanced/Deep onto step models + thinking.
 * Does not replace DB step_model_configs; overlays after loadStepModelsFromDB.
 */

import {
  isStepModelConfigured,
  setStepModel,
  setStepThinkingLevel,
  type ModelId,
  type StepThinkingLevel,
} from "@/lib/config/models";

export const EFFORT_TIERS = ["fast", "balanced", "deep"] as const;
export type EffortTier = (typeof EFFORT_TIERS)[number];

export function isEffortTier(value: string): value is EffortTier {
  return (EFFORT_TIERS as readonly string[]).includes(value);
}

export function normalizeEffortTier(raw: unknown): EffortTier {
  if (typeof raw === "string" && isEffortTier(raw.trim().toLowerCase())) {
    return raw.trim().toLowerCase() as EffortTier;
  }
  return "balanced";
}

const FAST_MODEL: ModelId =
  (process.env.EFFORT_FAST_MODEL?.trim() as ModelId) || "gemini-3-flash-preview";
const DEEP_MODEL: ModelId =
  (process.env.EFFORT_DEEP_MODEL?.trim() as ModelId) || "gemini-3.1-pro-preview";

const CHROME_STEPS = ["architect_scaffold_agent", "chrome_optimize_agent"] as const;
const PAGE_STEPS = ["page_implement_agent"] as const;
const PLAN_STEPS = ["plan_project", "analyze_project_requirement"] as const;

function applySteps(
  steps: readonly string[],
  model: ModelId,
  thinking: StepThinkingLevel | null
): void {
  for (const step of steps) {
    if (isStepModelConfigured(step)) continue;
    setStepModel(step, model);
    setStepThinkingLevel(step, thinking);
  }
}

/**
 * Overlay effort-tier model/thinking onto generation steps.
 * Call after `loadStepModelsFromDB()` so tier intent wins for the run.
 */
export function applyEffortTier(tier: EffortTier): void {
  if (tier === "balanced") {
    // Keep DB / runtime defaults.
    return;
  }

  if (tier === "fast") {
    applySteps(CHROME_STEPS, FAST_MODEL, "minimal");
    applySteps(PAGE_STEPS, FAST_MODEL, "low");
    applySteps(PLAN_STEPS, FAST_MODEL, "low");
    return;
  }

  // deep
  applySteps(CHROME_STEPS, DEEP_MODEL, "medium");
  applySteps(PAGE_STEPS, DEEP_MODEL, "medium");
  applySteps(PLAN_STEPS, DEEP_MODEL, "high");
}
