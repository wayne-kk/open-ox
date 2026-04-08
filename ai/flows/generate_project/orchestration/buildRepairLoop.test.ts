import { describe, expect, it } from "vitest";
import { summarizeBuildRepair } from "./buildRepairLoop";

describe("summarizeBuildRepair", () => {
  it("marks passed when any attempt passes", () => {
    const result = summarizeBuildRepair([
      { attempt: 0, buildPassed: false, output: "err" },
      { attempt: 1, buildPassed: true, output: "ok" },
    ]);
    expect(result.verificationStatus).toBe("passed");
    expect(result.buildSteps).toHaveLength(2);
  });
});
