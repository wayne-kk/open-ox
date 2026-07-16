import { describe, expect, it } from "vitest";
import {
  buildRepairRefeedBuildOutput,
  parseVerifierVerdict,
  shouldRefeedRepairFromVerifier,
} from "./parseVerifierVerdict";

describe("parseVerifierVerdict", () => {
  it("reads VERDICT line", () => {
    expect(
      parseVerifierVerdict("VERDICT: fail\nCHECKS:\n- [fail] missing export")
    ).toBe("fail");
    expect(parseVerifierVerdict("VERDICT: pass\nISSUES:\n- none")).toBe("pass");
    expect(parseVerifierVerdict("VERDICT: partial\nNOTES:\n- weak")).toBe("partial");
  });

  it("tolerates loose formatting", () => {
    expect(parseVerifierVerdict("Some preface\nVERDICT - Fail\nmore")).toBe("fail");
  });

  it("returns unknown when missing", () => {
    expect(parseVerifierVerdict("looks fine overall")).toBe("unknown");
    expect(parseVerifierVerdict("")).toBe("unknown");
  });
});

describe("shouldRefeedRepairFromVerifier", () => {
  it("refeeds only fail/partial", () => {
    expect(shouldRefeedRepairFromVerifier("fail")).toBe(true);
    expect(shouldRefeedRepairFromVerifier("partial")).toBe(true);
    expect(shouldRefeedRepairFromVerifier("pass")).toBe(false);
    expect(shouldRefeedRepairFromVerifier("unknown")).toBe(false);
    expect(shouldRefeedRepairFromVerifier(undefined)).toBe(false);
  });
});

describe("buildRepairRefeedBuildOutput", () => {
  it("appends verifier findings after build output", () => {
    const out = buildRepairRefeedBuildOutput({
      originalBuildOutput: "Type error in app/page.tsx",
      verifierReport: "[verifier]\nVERDICT: fail",
    });
    expect(out).toContain("Type error in app/page.tsx");
    expect(out).toContain("Verifier findings");
    expect(out).toContain("VERDICT: fail");
  });
});
