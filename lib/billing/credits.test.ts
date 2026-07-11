import { describe, expect, it, afterEach } from "vitest";
import {
  FREE_DAILY_CREDITS,
  FREE_MONTHLY_GRANT_CAP,
  freeDailyGrantAmount,
  isCreditsEnabled,
  usdToCredits,
  utcDateKey,
  utcMonthKey,
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

describe("freeDailyGrantAmount", () => {
  it("grants daily amount until monthly cap", () => {
    expect(freeDailyGrantAmount(0)).toBe(FREE_DAILY_CREDITS);
    expect(freeDailyGrantAmount(28)).toBe(2);
    expect(freeDailyGrantAmount(FREE_MONTHLY_GRANT_CAP)).toBe(0);
    expect(freeDailyGrantAmount(100)).toBe(0);
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
