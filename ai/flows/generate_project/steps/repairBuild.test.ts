import { describe, expect, it } from "vitest";
import { shouldShortCircuitRepairAfterCodeFix } from "./repairBuild";

describe("shouldShortCircuitRepairAfterCodeFix", () => {
  it("short-circuits when TS fixes touched files and diagnostics cleared", () => {
    expect(
      shouldShortCircuitRepairAfterCodeFix({
        resolved: true,
        touchedFiles: ["app/page.tsx"],
      })
    ).toBe(true);
  });

  it("does not short-circuit when TS is clean but build failed (e.g. Tailwind CSS)", () => {
    expect(
      shouldShortCircuitRepairAfterCodeFix({
        resolved: true,
        touchedFiles: [],
      })
    ).toBe(false);
  });

  it("does not short-circuit when diagnostics remain", () => {
    expect(
      shouldShortCircuitRepairAfterCodeFix({
        resolved: false,
        touchedFiles: ["app/page.tsx"],
      })
    ).toBe(false);
  });
});
