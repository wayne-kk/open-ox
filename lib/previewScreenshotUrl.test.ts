import { describe, expect, it } from "vitest";
import { previewUrlAllowedForScreenshot } from "./previewScreenshotUrl";

describe("previewUrlAllowedForScreenshot", () => {
  it("allows https E2B host", () => {
    const u = previewUrlAllowedForScreenshot("https://abc-123-3000.foo.e2b.app/foo");
    expect(u.hostname.endsWith(".e2b.app")).toBe(true);
  });

  it("allows http loopback", () => {
    const u = previewUrlAllowedForScreenshot("http://127.0.0.1:4123");
    expect(u.hostname).toBe("127.0.0.1");
  });

  it("rejects untrusted https host", () => {
    expect(() => previewUrlAllowedForScreenshot("https://example.com")).toThrow(/rejected/);
  });

  it("rejects file protocol", () => {
    expect(() => previewUrlAllowedForScreenshot("file:///etc/passwd")).toThrow();
  });

  it("allows https when host matches NEXT_PUBLIC_SITE_URL (no index.html in path)", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.example";
    try {
      const u = previewUrlAllowedForScreenshot("https://myapp.example/site-previews/p1");
      expect(u.hostname).toBe("myapp.example");
      const withSlash = previewUrlAllowedForScreenshot("https://myapp.example/site-previews/p1/");
      expect(withSlash.pathname).toBe("/site-previews/p1/");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it("allows dedicated NEXT_PUBLIC_PREVIEW_ORIGIN host", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.example";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "https://p.myapp.example";
    try {
      const u = previewUrlAllowedForScreenshot("https://p.myapp.example/p1");
      expect(u.hostname).toBe("p.myapp.example");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });

  it("allows http dedicated preview host (p.localhost)", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "http://p.localhost:3000";
    try {
      const u = previewUrlAllowedForScreenshot("http://p.localhost:3000/p1");
      expect(u.hostname).toBe("p.localhost");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });

  it("allows http *.localhost as loopback without PREVIEW_ORIGIN", () => {
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    try {
      const u = previewUrlAllowedForScreenshot("http://p.localhost:3000/p1");
      expect(u.hostname).toBe("p.localhost");
    } finally {
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });
});
