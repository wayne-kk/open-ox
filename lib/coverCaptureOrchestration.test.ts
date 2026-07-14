import { describe, expect, it } from "vitest";

import {
  buildCoverCaptureCjkFallbackCss,
  COVER_CAPTURE_PENDING_FRESH_MS,
  evaluateCoverCapturePoll,
  isAuthGatedPreviewFailureBody,
  isFreshCoverPending,
  isNewerCoverTimestamp,
} from "./coverCaptureOrchestration";

describe("buildCoverCaptureCjkFallbackCss", () => {
  it("redeclares Inter Fallback for CJK and lists system CJK locals", () => {
    const css = buildCoverCaptureCjkFallbackCss();
    expect(css).toContain('font-family: "Inter Fallback"');
    expect(css).toContain("U+4E00-9FFF");
    expect(css).toContain('local("Noto Sans CJK SC")');
    expect(css).toContain('local("PingFang SC")');
    expect(css).toContain("__ox_cjk_capture");
  });
});

describe("isAuthGatedPreviewFailureBody", () => {
  it("detects the site-previews Forbidden body", () => {
    expect(isAuthGatedPreviewFailureBody("Forbidden")).toBe(true);
    expect(isAuthGatedPreviewFailureBody("  Forbidden\n")).toBe(true);
    expect(isAuthGatedPreviewFailureBody("MCU 漫威电影宇宙史诗门户")).toBe(false);
    expect(isAuthGatedPreviewFailureBody("Forbidden to access this resource forever")).toBe(
      false
    );
  });
});

describe("isNewerCoverTimestamp", () => {
  it("treats any timestamp as newer than null baseline", () => {
    expect(isNewerCoverTimestamp("2026-07-10T10:00:00.000Z", null)).toBe(true);
  });

  it("requires strictly greater timestamp", () => {
    const a = "2026-07-10T10:00:00.000Z";
    expect(isNewerCoverTimestamp(a, a)).toBe(false);
    expect(isNewerCoverTimestamp("2026-07-10T10:00:01.000Z", a)).toBe(true);
  });
});

describe("isFreshCoverPending", () => {
  const now = Date.parse("2026-07-10T12:00:00.000Z");

  it("is true only for pending within the freshness window", () => {
    expect(
      isFreshCoverPending("pending", "2026-07-10T11:58:00.000Z", now, COVER_CAPTURE_PENDING_FRESH_MS)
    ).toBe(true);
    expect(
      isFreshCoverPending("pending", "2026-07-10T11:56:00.000Z", now, COVER_CAPTURE_PENDING_FRESH_MS)
    ).toBe(false);
    expect(isFreshCoverPending("ready", "2026-07-10T11:59:00.000Z", now)).toBe(false);
  });
});

describe("evaluateCoverCapturePoll", () => {
  const baseline = "2026-07-10T10:00:00.000Z";

  it("continues while still pending or unchanged ready", () => {
    expect(
      evaluateCoverCapturePoll({
        baselineUpdatedAt: baseline,
        status: "pending",
        updatedAt: "2026-07-10T10:00:30.000Z",
        elapsedMs: 5_000,
      }).verdict
    ).toBe("continue");

    expect(
      evaluateCoverCapturePoll({
        baselineUpdatedAt: baseline,
        status: "ready",
        updatedAt: baseline,
        elapsedMs: 5_000,
      }).verdict
    ).toBe("continue");
  });

  it("succeeds when ready with newer updatedAt", () => {
    expect(
      evaluateCoverCapturePoll({
        baselineUpdatedAt: baseline,
        status: "ready",
        updatedAt: "2026-07-10T10:01:00.000Z",
        elapsedMs: 8_000,
      }).verdict
    ).toBe("success");
  });

  it("fails with truncated hint when failed is newer than baseline", () => {
    const long = "x".repeat(200);
    const result = evaluateCoverCapturePoll({
      baselineUpdatedAt: baseline,
      status: "failed",
      updatedAt: "2026-07-10T10:01:00.000Z",
      error: long,
      elapsedMs: 8_000,
    });
    expect(result.verdict).toBe("failed");
    expect(result.errorHint?.endsWith("…")).toBe(true);
    expect(result.errorHint!.length).toBeLessThanOrEqual(121);
  });

  it("times out after the poll window", () => {
    expect(
      evaluateCoverCapturePoll({
        baselineUpdatedAt: baseline,
        status: "pending",
        updatedAt: "2026-07-10T10:00:30.000Z",
        elapsedMs: 3 * 60 * 1000,
      }).verdict
    ).toBe("timeout");
  });
});
