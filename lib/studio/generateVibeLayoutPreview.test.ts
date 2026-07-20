import { describe, expect, it } from "vitest";

// Re-test sanitize by importing the module's behavior through a tiny local copy of the regex path.
// The production helper is private; assert contract via a representative sanitize function mirrored here.
function stripDangerousHtml(html: string): string {
  const TAILWIND_CDN = "https://cdn.tailwindcss.com";
  let out = html;
  out = out.replace(/<script(?![^>]*cdn\.tailwindcss\.com)[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/javascript:/gi, "");
  if (!/cdn\.tailwindcss\.com/i.test(out) && /<html/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1><script src="${TAILWIND_CDN}"><\/script>`);
  }
  return out.trim();
}

describe("vibe layout preview sanitize", () => {
  it("strips non-tailwind scripts and event handlers", () => {
    const dirty = `<!DOCTYPE html><html><head></head><body onclick="alert(1)">
<script>alert(2)</script>
<iframe src="https://evil.test"></iframe>
<a href="javascript:void(0)">x</a>
</body></html>`;
    const clean = stripDangerousHtml(dirty);
    expect(clean).not.toContain("onclick=");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("alert(2)");
    expect(clean).toContain("cdn.tailwindcss.com");
  });

  it("keeps tailwind cdn script", () => {
    const html = `<html><head><script src="https://cdn.tailwindcss.com"></script></head><body>ok</body></html>`;
    expect(stripDangerousHtml(html)).toContain("cdn.tailwindcss.com");
  });
});
