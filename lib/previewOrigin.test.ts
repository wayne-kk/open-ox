import { afterEach, describe, expect, it } from "vitest";
import {
  PREVIEW_ACCESS_GRANT_QUERY,
  buildStaticPreviewUrl,
  getStoragePreviewBasePath,
  hostnameFromHostHeader,
  isDedicatedPreviewOrigin,
  isPreviewHostRequest,
  rewriteDedicatedPreviewPathname,
  withPreviewAccessGrantQuery,
} from "./previewOrigin";

describe("previewOrigin", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  });

  it("keeps legacy /site-previews path when preview origin unset", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    expect(isDedicatedPreviewOrigin()).toBe(false);
    expect(getStoragePreviewBasePath("p1")).toBe("/site-previews/p1");
    expect(buildStaticPreviewUrl("p1")).toBe("https://app.example.com/site-previews/p1");
  });

  it("uses root /{id} on a dedicated preview host", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "https://p.example.com";
    expect(isDedicatedPreviewOrigin()).toBe(true);
    expect(getStoragePreviewBasePath("2026-07-16T10-51-18-282Z_project")).toBe(
      `/${encodeURIComponent("2026-07-16T10-51-18-282Z_project")}`
    );
    expect(buildStaticPreviewUrl("2026-07-16T10-51-18-282Z_project")).toBe(
      `https://p.example.com/${encodeURIComponent("2026-07-16T10-51-18-282Z_project")}`
    );
  });

  it("treats same-host PREVIEW_ORIGIN as non-dedicated", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "http://localhost:3000";
    expect(isDedicatedPreviewOrigin()).toBe(false);
    expect(getStoragePreviewBasePath("p1")).toBe("/site-previews/p1");
  });

  it("rewrites dedicated preview pathnames to /site-previews", () => {
    expect(rewriteDedicatedPreviewPathname("/proj-a")).toBe("/site-previews/proj-a");
    expect(rewriteDedicatedPreviewPathname("/proj-a/_next/static/a.js")).toBe(
      "/site-previews/proj-a/_next/static/a.js"
    );
    expect(rewriteDedicatedPreviewPathname("/site-previews/proj-a")).toBe(null);
    expect(rewriteDedicatedPreviewPathname("/api/foo")).toBe(null);
  });

  it("appends ox_grant query", () => {
    const url = withPreviewAccessGrantQuery("https://p.example.com/p1", "tok");
    expect(url).toContain(`${PREVIEW_ACCESS_GRANT_QUERY}=tok`);
  });

  it("reads hostname from Host header including port", () => {
    expect(hostnameFromHostHeader("p.localhost:3000", "localhost")).toBe("p.localhost");
    expect(hostnameFromHostHeader(null, "localhost")).toBe("localhost");
  });

  it("detects dedicated preview host requests", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "http://p.localhost:3000";
    expect(isPreviewHostRequest("p.localhost")).toBe(true);
    expect(isPreviewHostRequest("localhost")).toBe(false);
  });
});
