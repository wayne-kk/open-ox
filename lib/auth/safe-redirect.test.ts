import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./safe-redirect";

describe("safeRedirectTarget", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectTarget("/projects")).toBe("/projects");
    expect(safeRedirectTarget("/studio/abc?tab=preview")).toBe("/studio/abc?tab=preview");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeRedirectTarget("//evil.com")).toBe("/projects");
    expect(safeRedirectTarget("https://evil.com")).toBe("/projects");
  });
});
