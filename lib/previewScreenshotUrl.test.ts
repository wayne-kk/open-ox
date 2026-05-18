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

  it("allows https when host matches NEXT_PUBLIC_SITE_URL", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://myapp.example";
    try {
      const u = previewUrlAllowedForScreenshot("https://myapp.example/site-previews/p1/index.html");
      expect(u.hostname).toBe("myapp.example");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
