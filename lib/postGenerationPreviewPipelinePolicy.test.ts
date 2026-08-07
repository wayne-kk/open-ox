import { describe, expect, it } from "vitest";
import {
  isPreparingStubPreviewSkip,
  shouldScheduleAutoCoverAfterPipeline,
} from "./postGenerationPreviewPipelinePolicy";

describe("isPreparingStubPreviewSkip", () => {
  it("detects Studio/worker soft-skip for Preparing stub home", () => {
    expect(
      isPreparingStubPreviewSkip({ skipped: true, skippedReason: "preparing_stub" })
    ).toBe(true);
  });

  it("is false for successful publish or fingerprint skip", () => {
    expect(isPreparingStubPreviewSkip({})).toBe(false);
    expect(isPreparingStubPreviewSkip({ skipped: true })).toBe(false);
    expect(
      isPreparingStubPreviewSkip({ skipped: true, skippedReason: "fingerprint_match" })
    ).toBe(false);
  });
});

describe("shouldScheduleAutoCoverAfterPipeline", () => {
  it("requires a ready static preview when Storage publish is on", () => {
    expect(
      shouldScheduleAutoCoverAfterPipeline({
        publishesStaticPreview: true,
        staticPreviewReady: false,
      })
    ).toBe(false);
    expect(
      shouldScheduleAutoCoverAfterPipeline({
        publishesStaticPreview: true,
        staticPreviewReady: true,
      })
    ).toBe(true);
  });

  it("allows cover when static publish is off (local next fallback)", () => {
    expect(
      shouldScheduleAutoCoverAfterPipeline({
        publishesStaticPreview: false,
        staticPreviewReady: false,
      })
    ).toBe(true);
  });
});
