import type { BuildStep } from "../types/build-studio";

/** Removed from the pipeline — hide from Studio even if persisted in older buildSteps. */
const HIDDEN_PIPELINE_STEPS = new Set(["match_design_system_skill"]);

export function isHiddenPipelineStep(stepName: string): boolean {
  return HIDDEN_PIPELINE_STEPS.has(stepName);
}

export function filterPipelineSteps(steps: BuildStep[]): BuildStep[] {
  return steps.filter(
    (step) => step.step !== "intent_agent" && !isHiddenPipelineStep(step.step),
  );
}
