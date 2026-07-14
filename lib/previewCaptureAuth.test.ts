import { describe, expect, it, afterEach, vi } from "vitest";

describe("previewCaptureAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects when secret unset", async () => {
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "");
    const { previewCaptureSecretMatches, previewCaptureExtraHeaders } = await import(
      "./previewCaptureAuth"
    );
    expect(previewCaptureSecretMatches("anything")).toBe(false);
    expect(previewCaptureExtraHeaders()).toBeNull();
  });

  it("matches configured secret", async () => {
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "cover-secret-test");
    const {
      previewCaptureSecretMatches,
      previewCaptureExtraHeaders,
      PREVIEW_CAPTURE_SECRET_HEADER,
    } = await import("./previewCaptureAuth");
    expect(previewCaptureSecretMatches("cover-secret-test")).toBe(true);
    expect(previewCaptureSecretMatches("wrong")).toBe(false);
    expect(previewCaptureExtraHeaders()).toEqual({
      [PREVIEW_CAPTURE_SECRET_HEADER]: "cover-secret-test",
    });
  });
});
