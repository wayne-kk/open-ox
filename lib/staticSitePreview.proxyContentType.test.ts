import { describe, expect, it } from "vitest";
import {
  contentTypeForRelPath,
  mapStorageUpstreamStatus,
  resolveProxiedContentType,
} from "./staticSitePreviewProxyMime";

describe("mapStorageUpstreamStatus", () => {
  it("maps Storage not_found JSON on HTTP 400 to 404", () => {
    expect(
      mapStorageUpstreamStatus(
        400,
        JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" })
      )
    ).toBe(404);
  });

  it("leaves other 400s unchanged", () => {
    expect(mapStorageUpstreamStatus(400, "Bad Request")).toBe(400);
    expect(mapStorageUpstreamStatus(400, null)).toBe(400);
  });

  it("leaves non-400 statuses unchanged", () => {
    expect(mapStorageUpstreamStatus(404, "")).toBe(404);
    expect(mapStorageUpstreamStatus(500, '{"statusCode":"404"}')).toBe(500);
  });
});

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
