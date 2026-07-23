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
  setConfiguredStepModel,
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

  it("does not replace an explicitly configured step model", () => {
    setConfiguredStepModel("page_implement_agent", "gemini-3.5-flash");
    applyEffortTier("fast");
    expect(getModelForStep("page_implement_agent")).toBe("gemini-3.5-flash");
  });

  it("balanced leaves step map empty (DB defaults)", () => {
    applyEffortTier("balanced");
    // No step override registered by balanced.
    expect(getThinkingLevelForStep("page_implement_agent")).toBeUndefined();
  });
});
