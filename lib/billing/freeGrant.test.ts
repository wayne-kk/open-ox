import { describe, expect, it } from "vitest";
import { applyFreeDailyGrant } from "./freeGrant";
import { FREE_DAILY_CREDITS, FREE_MONTHLY_GRANT_CAP } from "./credits";

describe("applyFreeDailyGrant", () => {
  it("grants daily credits on a new day", () => {
    const { next, granted, changed } = applyFreeDailyGrant(
      {
        balance: 0,
        lastDailyGrantDate: null,
        freeMonthKey: null,
        freeMonthGranted: 0,
      },
      new Date("2026-07-11T12:00:00.000Z")
    );
    expect(changed).toBe(true);
    expect(granted).toBe(FREE_DAILY_CREDITS);
    expect(next.balance).toBe(FREE_DAILY_CREDITS);
    expect(next.lastDailyGrantDate).toBe("2026-07-11");
    expect(next.freeMonthKey).toBe("2026-07");
    expect(next.freeMonthGranted).toBe(FREE_DAILY_CREDITS);
  });

  it("does not re-grant same UTC day", () => {
    const state = {
      balance: 2,
      lastDailyGrantDate: "2026-07-11",
      freeMonthKey: "2026-07",
      freeMonthGranted: 5,
    };
    const { changed, granted, next } = applyFreeDailyGrant(
      state,
      new Date("2026-07-11T23:00:00.000Z")
    );
    expect(changed).toBe(false);
    expect(granted).toBe(0);
    expect(next).toEqual(state);
  });

  it("replaces leftover free balance on a new day (no daily rollover)", () => {
    const { next, granted } = applyFreeDailyGrant(
      {
        balance: 3,
        lastDailyGrantDate: "2026-07-10",
        freeMonthKey: "2026-07",
        freeMonthGranted: 5,
      },
      new Date("2026-07-11T01:00:00.000Z")
    );
    expect(granted).toBe(FREE_DAILY_CREDITS);
    expect(next.balance).toBe(FREE_DAILY_CREDITS);
    expect(next.freeMonthGranted).toBe(10);
  });

  it("preserves balance above daily grant (e.g. Pro leftover after cancel)", () => {
    const { next, granted } = applyFreeDailyGrant(
      {
        balance: 80,
        lastDailyGrantDate: "2026-07-10",
        freeMonthKey: "2026-07",
        freeMonthGranted: 5,
      },
      new Date("2026-07-11T01:00:00.000Z")
    );
    expect(granted).toBe(FREE_DAILY_CREDITS);
    expect(next.balance).toBe(80);
  });

  it("stops granting after monthly cap", () => {
    const { next, granted } = applyFreeDailyGrant(
      {
        balance: 0,
        lastDailyGrantDate: "2026-07-10",
        freeMonthKey: "2026-07",
        freeMonthGranted: FREE_MONTHLY_GRANT_CAP,
      },
      new Date("2026-07-11T01:00:00.000Z")
    );
    expect(granted).toBe(0);
    expect(next.balance).toBe(0);
    expect(next.freeMonthGranted).toBe(FREE_MONTHLY_GRANT_CAP);
  });

  it("resets month counter on new month", () => {
    const { next, granted } = applyFreeDailyGrant(
      {
        balance: 0,
        lastDailyGrantDate: "2026-06-30",
        freeMonthKey: "2026-06",
        freeMonthGranted: FREE_MONTHLY_GRANT_CAP,
      },
      new Date("2026-07-01T00:00:00.000Z")
    );
    expect(granted).toBe(FREE_DAILY_CREDITS);
    expect(next.freeMonthKey).toBe("2026-07");
    expect(next.freeMonthGranted).toBe(FREE_DAILY_CREDITS);
  });
});
