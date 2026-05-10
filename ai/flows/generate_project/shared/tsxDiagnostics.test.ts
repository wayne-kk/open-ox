import { describe, expect, it } from "vitest";
import {
  formatTsxIssuesAsTscStyleLog,
  isGeneratedTypeScriptPath,
  type TsxIssue,
} from "./tsxDiagnostics";

describe("isGeneratedTypeScriptPath", () => {
  it("accepts every TS / JS source extension that participates in the import graph", () => {
    expect(isGeneratedTypeScriptPath("components/Foo.tsx")).toBe(true);
    expect(isGeneratedTypeScriptPath("app/page.tsx")).toBe(true);
    expect(isGeneratedTypeScriptPath("lib/bar.ts")).toBe(true);
    expect(isGeneratedTypeScriptPath("types/x.d.ts")).toBe(true);
    expect(isGeneratedTypeScriptPath("scripts/foo.js")).toBe(true);
    expect(isGeneratedTypeScriptPath("scripts/foo.jsx")).toBe(true);
    expect(isGeneratedTypeScriptPath("config.mjs")).toBe(true);
    expect(isGeneratedTypeScriptPath("config.cjs")).toBe(true);
  });

  it("rejects non-source files (markdown, css, json, images)", () => {
    expect(isGeneratedTypeScriptPath("README.md")).toBe(false);
    expect(isGeneratedTypeScriptPath("app/globals.css")).toBe(false);
    expect(isGeneratedTypeScriptPath("data.json")).toBe(false);
    expect(isGeneratedTypeScriptPath("logo.png")).toBe(false);
    expect(isGeneratedTypeScriptPath("no-extension")).toBe(false);
  });
});

describe("formatTsxIssuesAsTscStyleLog", () => {
  it("emits tsc-style lines for errors and warnings", () => {
    const issues: TsxIssue[] = [
      {
        file: "a.tsx",
        line: 1,
        column: 2,
        code: 1003,
        category: "error",
        message: "bad",
      },
      {
        file: "b.ts",
        line: 3,
        column: 1,
        code: 6133,
        category: "warning",
        message: "unused",
      },
    ];
    const out = formatTsxIssuesAsTscStyleLog(issues);
    expect(out).toContain("a.tsx(1,2): error TS1003: bad");
    expect(out).toContain("b.ts(3,1): warning TS6133: unused");
  });
});
