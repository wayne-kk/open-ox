import { describe, expect, it } from "vitest";
import {
  hasExplicitExtractOnlyIntent,
  hasStrongReplicateWording,
  resolveScreenshotIntentMode,
} from "./screenshotIntentMode";

describe("resolveScreenshotIntentMode", () => {
  it("defaults to replicate_layout when only screenshot is provided", () => {
    expect(resolveScreenshotIntentMode("", true)).toBe("replicate_layout");
  });

  it("treats 原设计/复刻 as replicate even with 参考", () => {
    expect(
      resolveScreenshotIntentMode("参考原设计效果截图，复刻 MoreAI 业务协同看板", true)
    ).toBe("replicate_layout");
    expect(resolveScreenshotIntentMode("按这张截图 1:1 还原", true)).toBe("replicate_layout");
  });

  it("keeps extract_inspiration for explicit style-only wording", () => {
    expect(resolveScreenshotIntentMode("参考截图的风格和配色，不必完全一样", true)).toBe(
      "extract_inspiration"
    );
  });

  it("returns none without screenshot", () => {
    expect(resolveScreenshotIntentMode("复刻这个页面", false)).toBe("none");
  });
});

describe("replicate wording helpers", () => {
  it("detects strong replicate phrases", () => {
    expect(hasStrongReplicateWording("原设计效果截图")).toBe(true);
    expect(hasStrongReplicateWording("只要配色")).toBe(false);
  });

  it("detects extract-only phrases", () => {
    expect(hasExplicitExtractOnlyIntent("参考风格类似即可")).toBe(true);
    expect(hasExplicitExtractOnlyIntent("复刻看板")).toBe(false);
  });
});
