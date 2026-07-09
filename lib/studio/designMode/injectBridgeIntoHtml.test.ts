import { describe, expect, it } from "vitest";
import {
  designModeBridgeScriptPath,
  injectDesignModeBridgeIntoHtml,
  shouldInjectDesignModeBridge,
} from "./injectBridgeIntoHtml";

describe("injectDesignModeBridgeIntoHtml", () => {
  it("injects script before closing head", () => {
    const html = "<!doctype html><html><head><title>x</title></head><body>hi</body></html>";
    const out = injectDesignModeBridgeIntoHtml(html, "/open-ox/design-mode-bridge.js");
    expect(out).toContain('<script src="/open-ox/design-mode-bridge.js" defer data-open-ox-design-bridge></script>');
    expect(out.indexOf("<script")).toBeLessThan(out.indexOf("<body"));
  });

  it("detects html assets", () => {
    expect(shouldInjectDesignModeBridge("index.html", "text/html")).toBe(true);
    expect(shouldInjectDesignModeBridge("_next/static/chunk.js", "application/javascript")).toBe(false);
  });

  it("exposes a public (non-/studio) script path", () => {
    expect(designModeBridgeScriptPath()).toBe("/open-ox/design-mode-bridge.js");
    expect(designModeBridgeScriptPath().startsWith("/studio")).toBe(false);
  });
});
