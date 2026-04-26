import { describe, expect, it } from "vitest";
import {
  formatTsxIssuesAsTscStyleLog,
  isGeneratedTypeScriptPath,
  type TsxIssue,
} from "./tsxDiagnostics";

describe("isGeneratedTypeScriptPath", () => {
  it("accepts tsx only", () => {
    expect(isGeneratedTypeScriptPath("components/Foo.tsx")).toBe(true);
    expect(isGeneratedTypeScriptPath("app/page.tsx")).toBe(true);
  });

  it("rejects plain ts and other files", () => {
    expect(isGeneratedTypeScriptPath("lib/bar.ts")).toBe(false);
    expect(isGeneratedTypeScriptPath("types/x.d.ts")).toBe(false);
    expect(isGeneratedTypeScriptPath("README.md")).toBe(false);
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
