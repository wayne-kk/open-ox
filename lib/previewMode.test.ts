import { afterEach, describe, expect, it, vi } from "vitest";

describe("getPreviewBackend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("respects explicit OPEN_OX_PREVIEW_BACKEND", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPEN_OX_PREVIEW_BACKEND", "local");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "x");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { getPreviewBackend } = await import("./previewMode");
    expect(getPreviewBackend()).toBe("local");
  });

  it("defaults to storage in development when Supabase preview deps are set and backend unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPEN_OX_PREVIEW_BACKEND", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { getPreviewBackend } = await import("./previewMode");
    expect(getPreviewBackend()).toBe("storage");
  });

  it("defaults to local in development when service role missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPEN_OX_PREVIEW_BACKEND", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { getPreviewBackend } = await import("./previewMode");
    expect(getPreviewBackend()).toBe("local");
  });

  it("defaults to local in production when backend unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPEN_OX_PREVIEW_BACKEND", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
    const { getPreviewBackend } = await import("./previewMode");
    expect(getPreviewBackend()).toBe("local");
  });
});

describe("shouldPublishStaticSitePreview", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("publishes when Supabase deps exist even if preview backend is local", async () => {
    vi.stubEnv("OPEN_OX_PREVIEW_BACKEND", "local");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { shouldPublishStaticSitePreview } = await import("./previewMode");
    expect(shouldPublishStaticSitePreview()).toBe(true);
  });

  it("skips publish when OPEN_OX_SKIP_STATIC_PREVIEW_PUBLISH=1", async () => {
    vi.stubEnv("OPEN_OX_SKIP_STATIC_PREVIEW_PUBLISH", "1");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://a.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { shouldPublishStaticSitePreview } = await import("./previewMode");
    expect(shouldPublishStaticSitePreview()).toBe(false);
  });
});
