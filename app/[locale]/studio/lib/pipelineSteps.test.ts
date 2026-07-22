import { describe, expect, it } from "vitest";
import type { BuildStep } from "../types/build-studio";
import { filterPipelineSteps } from "./pipelineSteps";

function step(name: string): BuildStep {
  return {
    step: name,
    status: "ok",
    timestamp: 1,
    duration: 1,
  };
}

describe("filterPipelineSteps", () => {
  it("keeps design-system skill matching visible in Studio", () => {
    const filtered = filterPipelineSteps([
      step("intent_agent"),
      step("match_design_system_skill"),
      step("generate_project_design_system"),
    ]);

    expect(filtered.map((item) => item.step)).toEqual([
      "match_design_system_skill",
      "generate_project_design_system",
    ]);
  });
});
