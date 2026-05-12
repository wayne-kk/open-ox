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
});
