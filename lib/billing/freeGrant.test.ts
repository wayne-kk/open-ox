import { describe, expect, it } from "vitest";
import { applyFreeDailyGrant } from "./freeGrant";

describe("applyFreeDailyGrant", () => {
  it("is a no-op after welcome-pack Free tier (no daily grants)", () => {
    const state = {
      balance: 3,
      lastDailyGrantDate: "2026-07-10",
      freeMonthKey: "2026-07",
      freeMonthGranted: 5,
    };
    const { next, granted, changed } = applyFreeDailyGrant(
      state,
      new Date("2026-07-11T12:00:00.000Z")
    );
    expect(changed).toBe(false);
    expect(granted).toBe(0);
    expect(next).toEqual(state);
  });
});
