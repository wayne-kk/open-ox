import { describe, expect, it } from "vitest";
import { isGenerateRunBillable } from "./chargeRun";

describe("isGenerateRunBillable", () => {
  it("bills when generate produced a deliverable (success)", () => {
    expect(isGenerateRunBillable({ success: true })).toBe(true);
  });

  it("does not bill failed or non-deliverable generate runs", () => {
    expect(isGenerateRunBillable({ success: false })).toBe(false);
  });
});
