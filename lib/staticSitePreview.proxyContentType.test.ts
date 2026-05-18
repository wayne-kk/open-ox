import { describe, expect, it } from "vitest";
import { contentTypeForRelPath, resolveProxiedContentType } from "./staticSitePreview";

describe("resolveProxiedContentType", () => {
  it("uses path map for gif", () => {
    expect(resolveProxiedContentType("_next/foo.gif", "text/plain")).toBe("image/gif");
    expect(contentTypeForRelPath("x.gif")).toBe("image/gif");
  });

  it("falls back to upstream for extensionless media", () => {
    expect(
      resolveProxiedContentType("_next/static/media/xyz", "image/png; charset=utf-8")
    ).toBe("image/png");
  });

  it("rejects text/plain upstream for binary-looking paths", () => {
    expect(resolveProxiedContentType("_next/static/media/foo", "text/plain")).toBe(
      "application/octet-stream"
    );
  });

  it("uses upstream image type when path has no known extension", () => {
    expect(resolveProxiedContentType("_next/static/media/abc123", "image/jpeg")).toBe("image/jpeg");
  });

  it("allows text/plain only for text-like paths when using upstream fallback", () => {
    expect(resolveProxiedContentType("notes.txt", "text/plain")).toBe("text/plain; charset=utf-8");
  });
});
