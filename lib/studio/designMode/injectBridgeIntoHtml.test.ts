import { describe, expect, it } from "vitest";
import {
  designModeBridgeScriptPath,
  injectDesignModeBridgeIntoHtml,
  shouldInjectDesignModeBridge,
  stripCrossoriginFromPreviewFontLinks,
} from "./injectBridgeIntoHtml";

describe("injectDesignModeBridgeIntoHtml", () => {
  it("injects script before closing head", () => {
    const html = "<!doctype html><html><head><title>x</title></head><body>hi</body></html>";
    const out = injectDesignModeBridgeIntoHtml(html, "/open-ox/design-mode-bridge.js");
    expect(out).toContain('<script src="/open-ox/design-mode-bridge.js" defer data-open-ox-design-bridge></script>');
    expect(out.indexOf("<script")).toBeLessThan(out.indexOf("<body"));
  });

  it("strips crossorigin from font preloads so grant cookies are sent", () => {
    const html =
      '<link rel="preload" href="/p/_next/static/media/a.woff2" as="font" crossorigin="" type="font/woff2"/>' +
      '<link rel="stylesheet" href="/p/a.css" crossorigin="anonymous"/>';
    const out = stripCrossoriginFromPreviewFontLinks(html);
    expect(out).toContain('as="font"');
    expect(out).not.toMatch(/as="font"[^>]*crossorigin/i);
    expect(out).toContain('crossorigin="anonymous"');
    const injected = injectDesignModeBridgeIntoHtml(
      `<html><head>${html}</head><body></body></html>`,
      "/bridge.js"
    );
    expect(injected).not.toMatch(/as="font"[^>]*crossorigin/i);
  });

  it("detects html assets", () => {
    expect(shouldInjectDesignModeBridge("index.html", "text/html")).toBe(true);
    expect(shouldInjectDesignModeBridge("_next/static/chunk.js", "application/javascript")).toBe(false);
  });

  it("exposes a public (non-/studio) script path", () => {
    expect(designModeBridgeScriptPath()).toBe("/open-ox/design-mode-bridge.js");
    expect(designModeBridgeScriptPath().startsWith("/studio")).toBe(false);
  });

  it("points bridge at Studio origin when preview uses a dedicated host", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevPreview = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = "https://p.example.com";
    try {
      expect(designModeBridgeScriptPath()).toBe(
        "https://app.example.com/open-ox/design-mode-bridge.js"
      );
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevPreview === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
      else process.env.NEXT_PUBLIC_PREVIEW_ORIGIN = prevPreview;
    }
  });
});
