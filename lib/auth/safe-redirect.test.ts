import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./safe-redirect";

describe("safeRedirectTarget", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectTarget("/dashboard")).toBe("/dashboard");
    expect(safeRedirectTarget("/studio/abc?tab=preview")).toBe("/studio/abc?tab=preview");
  });

  it("maps marketing home to dashboard", () => {
    expect(safeRedirectTarget("/")).toBe("/dashboard");
    expect(safeRedirectTarget("/?utm=1")).toBe("/dashboard");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeRedirectTarget("//evil.com")).toBe("/dashboard");
    expect(safeRedirectTarget("https://evil.com")).toBe("/dashboard");
  });
});
