import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPreviewUpstreamCache,
  getCachedPreviewUpstream,
  previewUpstreamCacheStats,
  setCachedPreviewUpstream,
  shouldCachePreviewUpstream,
} from "./staticSitePreviewUpstreamCache";

describe("staticSitePreviewUpstreamCache", () => {
  afterEach(() => {
    clearPreviewUpstreamCache();
    vi.unstubAllEnvs();
  });

  it("only caches hashed _next/static paths", () => {
    expect(shouldCachePreviewUpstream("_next/static/chunks/a.js")).toBe(true);
    expect(shouldCachePreviewUpstream("index.html")).toBe(false);
    expect(shouldCachePreviewUpstream("images/hero.png")).toBe(false);
  });

  it("round-trips immutable objects and refreshes LRU", () => {
    const body = Buffer.from([1, 2, 3, 4]);
    setCachedPreviewUpstream("p1", "_next/static/chunks/a.js", {
      body,
      contentType: "application/javascript",
      etag: '"abc"',
      contentLength: "4",
    });
    const hit = getCachedPreviewUpstream("p1", "_next/static/chunks/a.js");
    expect(hit?.body.equals(body)).toBe(true);
    expect(hit?.etag).toBe('"abc"');
    expect(previewUpstreamCacheStats().entries).toBe(1);
  });

  it("does not cache HTML", () => {
    setCachedPreviewUpstream("p1", "index.html", {
      body: Buffer.from([9]),
      contentType: "text/html",
      etag: null,
      contentLength: "1",
    });
    expect(getCachedPreviewUpstream("p1", "index.html")).toBeNull();
    expect(previewUpstreamCacheStats().entries).toBe(0);
  });

  it("respects entry cap via env", () => {
    vi.stubEnv("OPEN_OX_PREVIEW_UPSTREAM_CACHE_ENTRIES", "1");
    setCachedPreviewUpstream("p1", "_next/static/a.js", {
      body: Buffer.from([1]),
      contentType: null,
      etag: null,
      contentLength: null,
    });
    setCachedPreviewUpstream("p1", "_next/static/b.js", {
      body: Buffer.from([2]),
      contentType: null,
      etag: null,
      contentLength: null,
    });
    expect(previewUpstreamCacheStats().entries).toBe(1);
    expect(getCachedPreviewUpstream("p1", "_next/static/a.js")).toBeNull();
    expect(
      getCachedPreviewUpstream("p1", "_next/static/b.js")?.body.equals(Buffer.from([2]))
    ).toBe(true);
  });
});
