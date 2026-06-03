import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveUserProvidedImages } from "./resolveUserProvidedImages";
import * as siteImageAsset from "./siteImageAsset";

describe("resolveUserProvidedImages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses downloaded image path when fetch succeeds", async () => {
    vi.spyOn(siteImageAsset, "downloadProjectImage").mockResolvedValue({
      ok: true,
      path: "/images/user-hero-1.jpg",
      bytes: 1024,
    });

    const { content, stats } = await resolveUserProvidedImages({
      images: [{ url: "https://example.com/a.jpg", caption: "Hero" }],
    });

    expect(stats).toMatchObject({
      imageTotal: 1,
      downloaded: 1,
      failed: 0,
    });
    expect(stats.attempts[0]?.url).toBe("https://example.com/a.jpg");
    expect(content.images?.[0]).toMatchObject({
      path: "/images/user-hero-1.jpg",
      source: "download",
    });
  });

  it("does not generate when download fails", async () => {
    vi.spyOn(siteImageAsset, "downloadProjectImage").mockResolvedValue({
      ok: false,
      error: "HTTP 403",
    });
    const generateSpy = vi.spyOn(siteImageAsset, "generateProjectImage");

    const { content, stats } = await resolveUserProvidedImages({
      images: [{ url: "https://example.com/blocked.jpg", role: "hero" }],
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(stats.failed).toBe(1);
    expect(stats.failures[0]?.url).toBe("https://example.com/blocked.jpg");
    expect(content.images?.[0]?.path).toBeUndefined();
    expect(content.images?.[0]?.error).toBe("HTTP 403");
  });
});
