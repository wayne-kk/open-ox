import { describe, expect, it, afterEach } from "vitest";
import {
  isScreenshotReplicaPipelineEnabled,
  isScreenshotReplicateIntent,
  resolvePageGenerationScreenshotMode,
  shouldBlockSkillsForScreenshotReplicate,
  shouldScanPromptForUserImageUrls,
  shouldSkipChromeScaffoldForScreenshotReplicate,
  shouldUseScreenshotReplicaPipeline,
} from "./screenshotReplicaPipeline";

describe("screenshotReplicaPipeline", () => {
  const prev = process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE;
    } else {
      process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE = prev;
    }
  });

  it("blocks skills for screenshot replicate scenarios", () => {
    expect(shouldBlockSkillsForScreenshotReplicate("replicate_layout", true)).toBe(true);
    expect(
      shouldBlockSkillsForScreenshotReplicate(
        "extract_inspiration",
        true,
        "参考原设计效果截图，生成看板"
      )
    ).toBe(true);
    expect(
      shouldBlockSkillsForScreenshotReplicate(
        "extract_inspiration",
        true,
        "参考截图的风格类似即可"
      )
    ).toBe(false);
    expect(shouldBlockSkillsForScreenshotReplicate("replicate_layout", false)).toBe(false);
    expect(shouldBlockSkillsForScreenshotReplicate("none", true, "复刻")).toBe(false);
  });

  it("uses replica pipeline only when flag + replicate + screenshot", () => {
    process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE = "1";
    expect(
      shouldUseScreenshotReplicaPipeline({
        screenshotIntentMode: "replicate_layout",
        referenceScreenshotDataUrl: "data:image/png;base64,abc",
      })
    ).toBe(true);
    expect(
      shouldUseScreenshotReplicaPipeline({
        screenshotIntentMode: "extract_inspiration",
        referenceScreenshotDataUrl: "data:image/png;base64,abc",
      })
    ).toBe(false);
    process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE = "0";
    expect(
      shouldUseScreenshotReplicaPipeline({
        screenshotIntentMode: "replicate_layout",
        referenceScreenshotDataUrl: "data:image/png;base64,abc",
      })
    ).toBe(false);
  });

  it("treats one screenshot as inspiration when generating multiple routes", () => {
    expect(resolvePageGenerationScreenshotMode("replicate_layout", 3)).toBe("extract_inspiration");
    expect(resolvePageGenerationScreenshotMode("replicate_layout", 1)).toBe("replicate_layout");
  });

  it("isScreenshotReplicaPipelineEnabled respects env", () => {
    delete process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE;
    expect(isScreenshotReplicaPipelineEnabled()).toBe(true);
    process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE = "0";
    expect(isScreenshotReplicaPipelineEnabled()).toBe(false);
    process.env.ENABLE_SCREENSHOT_REPLICA_PIPELINE = "1";
    expect(isScreenshotReplicaPipelineEnabled()).toBe(true);
  });

  it("isScreenshotReplicateIntent mirrors replicate_layout + image", () => {
    expect(isScreenshotReplicateIntent("replicate_layout", true)).toBe(true);
    expect(isScreenshotReplicateIntent("extract_inspiration", true)).toBe(false);
  });

  it("skips prompt image scan for replicate_layout + screenshot", () => {
    expect(shouldScanPromptForUserImageUrls("replicate_layout", true)).toBe(false);
    expect(shouldScanPromptForUserImageUrls("extract_inspiration", true)).toBe(true);
  });

  it("skips chrome scaffold for replicate_layout + screenshot", () => {
    expect(shouldSkipChromeScaffoldForScreenshotReplicate("replicate_layout", true)).toBe(true);
    expect(shouldSkipChromeScaffoldForScreenshotReplicate("extract_inspiration", true)).toBe(
      false
    );
  });
});
