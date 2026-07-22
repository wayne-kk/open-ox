import type { BuildStep } from "../types/build-studio";

export function filterPipelineSteps(steps: BuildStep[]): BuildStep[] {
  return steps.filter((step) => step.step !== "intent_agent");
}
