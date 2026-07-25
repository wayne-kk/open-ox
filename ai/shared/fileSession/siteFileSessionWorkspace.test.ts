import { describe, expect, it } from "vitest";
import { applyFileSessionEdits } from "./siteFileSessionWorkspace";

describe("applyFileSessionEdits", () => {
  it("returns a domain range error instead of leaking a TypeScript Debug Failure", () => {
    expect(() => applyFileSessionEdits("export const value = 1;\n", [{
      range: {
        start: { line: 99, character: 0 },
        end: { line: 99, character: 1 },
      },
      newText: "2",
    }])).toThrow("INVALID_PATCH_RANGE");
  });

  it("rejects a character beyond the requested line before converting it", () => {
    expect(() => applyFileSessionEdits("short\nnext", [{
      range: { start: { line: 0, character: 8 }, end: { line: 0, character: 8 } },
      newText: "x",
    }])).toThrow("INVALID_PATCH_RANGE");
  });

  it("applies valid CRLF coordinates without including the carriage return", () => {
    expect(applyFileSessionEdits("one\r\ntwo\r\n", [{
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } },
      newText: "three",
    }])).toBe("one\r\nthree\r\n");
  });
});
