import { describe, expect, it } from "vitest";
import {
  buildVerifierRefeedBuildOutput,
  mergeRepairTouchedFiles,
  repairVerifierNeedsRefeed,
} from "./verifierRepairRefeed";

describe("repairVerifierNeedsRefeed", () => {
  it("requires successful repair plus skeptical verdict and report", () => {
    expect(
      repairVerifierNeedsRefeed({
        success: true,
        verifierVerdict: "fail",
        verifierReport: "[verifier]\nVERDICT: fail",
      })
    ).toBe(true);
    expect(
      repairVerifierNeedsRefeed({
        success: true,
        verifierVerdict: "pass",
        verifierReport: "[verifier]\nVERDICT: pass",
      })
    ).toBe(false);
    expect(
      repairVerifierNeedsRefeed({
        success: false,
        verifierVerdict: "fail",
        verifierReport: "[verifier]\nVERDICT: fail",
      })
    ).toBe(false);
    expect(
      repairVerifierNeedsRefeed({
        success: true,
        verifierVerdict: "fail",
        verifierReport: "",
      })
    ).toBe(false);
  });
});

describe("buildVerifierRefeedBuildOutput", () => {
  it("prefers verifierReport over full repair output", () => {
    const out = buildVerifierRefeedBuildOutput({
      originalBuildOutput: "build boom",
      repairResult: {
        verifierReport: "VERDICT: fail",
        output: "repair_build: patched …\n\n[verifier]\nVERDICT: fail",
      },
    });
    expect(out).toContain("build boom");
    expect(out).toContain("VERDICT: fail");
  });
});

describe("mergeRepairTouchedFiles", () => {
  it("unions touched paths", () => {
    expect(
      mergeRepairTouchedFiles(
        { success: true, output: "", touchedFiles: ["a.tsx", "b.tsx"] },
        { success: true, output: "", touchedFiles: ["b.tsx", "c.tsx"] }
      )
    ).toEqual(["a.tsx", "b.tsx", "c.tsx"]);
  });
});
