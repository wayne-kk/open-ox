import { describe, expect, it } from "vitest";
import {
  classifyGenerationRunCompletion,
  selectEffectiveGenerationPrompt,
  selectPreviousCommittedGenerationPrompt,
  shouldEnableIntentGuideForGeneration,
} from "./intentGuideLifecycle";

describe("Intent guide generation lifecycle", () => {
  it("does not re-run intent guidance when retrying a failed build", () => {
    expect(
      shouldEnableIntentGuideForGeneration({
        retryProjectId: "failed-project",
        requested: undefined,
      }),
    ).toBe(false);
  });

  it("keeps intent guidance enabled by default for a new direct generation", () => {
    expect(
      shouldEnableIntentGuideForGeneration({
        retryProjectId: undefined,
        requested: undefined,
      }),
    ).toBe(true);
  });

  it("honors an explicit intent-guidance opt-out for a new generation", () => {
    expect(
      shouldEnableIntentGuideForGeneration({
        retryProjectId: undefined,
        requested: false,
      }),
    ).toBe(false);
  });

  it("reuses the last committed build brief when retry has no new prompt", () => {
    expect(
      selectEffectiveGenerationPrompt({
        retryProjectId: "failed-project",
        requestPrompt: undefined,
        previousRunPrompt: "# Confirmed Pop Mart build brief",
        projectPrompt: "Build a Pop Mart site",
      }),
    ).toBe("# Confirmed Pop Mart build brief");
  });

  it("skips a deferred retry prompt when recovering the last committed brief", () => {
    expect(
      selectPreviousCommittedGenerationPrompt([
        {
          enableIntentGuide: true,
          effectivePrompt: "Build a Pop Mart site",
        },
        {
          enableIntentGuide: false,
          effectivePrompt: "# Confirmed Pop Mart build brief",
        },
      ]),
    ).toBe("# Confirmed Pop Mart build brief");
  });

  it("does not fall back to an uncommitted deferred prompt", () => {
    expect(
      selectPreviousCommittedGenerationPrompt([
        {
          enableIntentGuide: true,
          effectivePrompt: "Build a Pop Mart site",
        },
      ]),
    ).toBeUndefined();
  });

  it("treats an intent-guidance yield as awaiting input instead of failure", () => {
    expect(
      classifyGenerationRunCompletion({
        success: false,
        error: "INTENT_GUIDE_DEFERRED",
        intentGuideDeferred: true,
        intentGuide: { assistantMessage: "Which direction should we use?" },
      }),
    ).toEqual({
      kind: "awaiting_input",
      projectStatus: "awaiting_input",
      runStatus: "succeeded",
      runError: null,
    });
  });

  it("keeps actual generation errors failed", () => {
    expect(
      classifyGenerationRunCompletion({
        success: false,
        error: "Generated design system failed contract validation",
      }),
    ).toEqual({
      kind: "failed",
      projectStatus: "failed",
      runStatus: "failed",
      runError: "Generated design system failed contract validation",
    });
  });
});
