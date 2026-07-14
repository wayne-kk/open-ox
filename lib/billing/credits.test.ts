import { describe, expect, it, afterEach } from "vitest";
import {
  MIN_GENERATE_CREDITS,
  MIN_MODIFY_CREDITS,
  WELCOME_CREDITS,
  clampSpendAmount,
  freeDailyGrantAmount,
  isCreditsEnabled,
  usdToCredits,
  utcDateKey,
  utcMonthKey,
  welcomeGrantIdempotencyKey,
  welcomeMigrateIdempotencyKey,
} from "./credits";

describe("usdToCredits", () => {
  const prevRate = process.env.CREDITS_USD_PER_CREDIT;
  const prevMargin = process.env.CREDITS_MARGIN;

  afterEach(() => {
    process.env.CREDITS_USD_PER_CREDIT = prevRate;
    process.env.CREDITS_MARGIN = prevMargin;
  });

  it("returns 0 for zero or negative cost", () => {
    expect(usdToCredits(0)).toBe(0);
    expect(usdToCredits(-1)).toBe(0);
  });

  it("converts at $0.25/credit and rounds up to 1 decimal", () => {
    delete process.env.CREDITS_USD_PER_CREDIT;
    delete process.env.CREDITS_MARGIN;
    // $0.25 → 1.0 credit
    expect(usdToCredits(0.25)).toBe(1);
    // $0.26 → 1.1 (ceil)
    expect(usdToCredits(0.26)).toBe(1.1);
    // tiny non-zero floors at 0.1
    expect(usdToCredits(0.001)).toBe(0.1);
  });

  it("applies margin", () => {
    process.env.CREDITS_USD_PER_CREDIT = "0.25";
    process.env.CREDITS_MARGIN = "2";
    expect(usdToCredits(0.25)).toBe(2);
  });
});

describe("welcome Free pack", () => {
  it("grants 12 welcome credits once per user key", () => {
    expect(WELCOME_CREDITS).toBe(12);
    expect(welcomeGrantIdempotencyKey("abc")).toBe("welcome:abc");
    expect(welcomeMigrateIdempotencyKey("abc")).toBe("welcome_migrate_v3:abc");
  });

  it("no longer grants daily Free credits", () => {
    expect(freeDailyGrantAmount(0)).toBe(0);
    expect(freeDailyGrantAmount(28)).toBe(0);
  });

  it("requires 8 credits to start Generate and 0.5 to Modify", () => {
    expect(MIN_GENERATE_CREDITS).toBe(8);
    expect(MIN_MODIFY_CREDITS).toBe(0.5);
    expect(7.9 >= MIN_GENERATE_CREDITS).toBe(false);
    expect(7.9 >= MIN_MODIFY_CREDITS).toBe(true);
  });
});

describe("clampSpendAmount", () => {
  it("charges full amount when usage is under balance", () => {
    expect(clampSpendAmount(3.2, 10)).toBe(3.2);
  });

  it("charges exact balance when usage matches balance", () => {
    expect(clampSpendAmount(4, 4)).toBe(4);
  });

  it("clamps to balance when usage exceeds balance", () => {
    expect(clampSpendAmount(10, 4)).toBe(4);
  });

  it("returns 0 for zero/negative usage or zero balance", () => {
    expect(clampSpendAmount(0, 5)).toBe(0);
    expect(clampSpendAmount(-1, 5)).toBe(0);
    expect(clampSpendAmount(3, 0)).toBe(0);
  });
});

describe("date keys", () => {
  it("formats UTC date and month", () => {
    const d = new Date("2026-07-11T15:00:00.000Z");
    expect(utcDateKey(d)).toBe("2026-07-11");
    expect(utcMonthKey(d)).toBe("2026-07");
  });
});

describe("isCreditsEnabled", () => {
  const prev = process.env.CREDITS_ENABLED;
  afterEach(() => {
    process.env.CREDITS_ENABLED = prev;
  });

  it("is off by default", () => {
    delete process.env.CREDITS_ENABLED;
    expect(isCreditsEnabled()).toBe(false);
  });

  it("recognizes 1/true/yes", () => {
    process.env.CREDITS_ENABLED = "1";
    expect(isCreditsEnabled()).toBe(true);
    process.env.CREDITS_ENABLED = "true";
    expect(isCreditsEnabled()).toBe(true);
  });
});
