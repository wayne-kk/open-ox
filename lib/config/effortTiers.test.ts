import { describe, expect, it, beforeEach } from "vitest";
import {
  applyEffortTier,
  isEffortTier,
  normalizeEffortTier,
} from "./effortTiers";
import {
  clearStepModels,
  getModelForStep,
  getThinkingLevelForStep,
} from "./models";

describe("effortTiers", () => {
  beforeEach(() => {
    clearStepModels();
  });

  it("normalizes tier ids", () => {
    expect(normalizeEffortTier("Fast")).toBe("fast");
    expect(normalizeEffortTier("nope")).toBe("balanced");
    expect(isEffortTier("deep")).toBe(true);
  });

  it("fast overlays flash + low thinking on page/scaffold", () => {
    applyEffortTier("fast");
    expect(getModelForStep("page_implement_agent")).toContain("flash");
    expect(getThinkingLevelForStep("architect_scaffold_agent")).toBe("minimal");
  });

  it("deep overlays stronger model", () => {
    applyEffortTier("deep");
    expect(getModelForStep("architect_scaffold_agent")).not.toContain("flash");
    expect(getThinkingLevelForStep("plan_project")).toBe("high");
  });

  it("balanced leaves step map empty (DB defaults)", () => {
    applyEffortTier("balanced");
    // No step override registered by balanced.
    expect(getThinkingLevelForStep("page_implement_agent")).toBeUndefined();
  });
});
