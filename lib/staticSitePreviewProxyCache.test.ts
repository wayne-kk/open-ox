import { describe, expect, it } from "vitest";
import {
  cacheControlForPreviewRel,
  isImmutablePreviewStaticRel,
  isPreviewHtmlRel,
  upstreamFetchCacheMode,
} from "./staticSitePreviewProxyCache";

describe("isImmutablePreviewStaticRel", () => {
  it("matches Next hashed static tree", () => {
    expect(isImmutablePreviewStaticRel("_next/static/chunks/main.js")).toBe(true);
    expect(isImmutablePreviewStaticRel("/_next/static/css/a.css")).toBe(true);
    expect(isImmutablePreviewStaticRel("_next/static/media/f.woff2")).toBe(true);
  });

  it("rejects HTML and other paths", () => {
    expect(isImmutablePreviewStaticRel("index.html")).toBe(false);
    expect(isImmutablePreviewStaticRel("_next/data/x.json")).toBe(false);
    expect(isImmutablePreviewStaticRel("images/hero.png")).toBe(false);
  });
});

describe("cacheControlForPreviewRel", () => {
  it("uses immutable year cache for _next/static", () => {
    expect(cacheControlForPreviewRel("_next/static/chunks/a.js")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it("uses must-revalidate for HTML shell", () => {
    expect(cacheControlForPreviewRel("index.html")).toBe(
      "public, max-age=0, must-revalidate"
    );
    expect(cacheControlForPreviewRel("about.html")).toBe(
      "public, max-age=0, must-revalidate"
    );
    expect(isPreviewHtmlRel("")).toBe(true);
  });

  it("keeps short TTL for non-hashed assets", () => {
    expect(cacheControlForPreviewRel("images/hero.png")).toBe(
      "public, max-age=60, s-maxage=60"
    );
  });
});

describe("upstreamFetchCacheMode", () => {
  it("allows default cache only for immutable static", () => {
    expect(upstreamFetchCacheMode("_next/static/chunks/a.js")).toBe("default");
    expect(upstreamFetchCacheMode("index.html")).toBe("no-store");
    expect(upstreamFetchCacheMode("images/x.png")).toBe("no-store");
  });
});
