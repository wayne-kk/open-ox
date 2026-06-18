import { describe, expect, it } from "vitest";
import {
  computeKpiSnapshot,
  formatDateKey,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
  emptySeries,
  incrementSeries,
} from "@/lib/admin/analytics/dateRange";

describe("parseDateRange", () => {
  it("defaults to 30 days ending today", () => {
    const { from, to, days } = parseDateRange({});
    expect(days).toBe(30);
    expect(formatDateKey(to)).toBe(formatDateKey(new Date()));
    expect(listDateKeys(from, to)).toHaveLength(30);
  });

  it("parses explicit from/to", () => {
    const { from, to, days } = parseDateRange({ from: "2026-06-01", to: "2026-06-07" });
    expect(formatDateKey(from)).toBe("2026-06-01");
    expect(formatDateKey(to)).toBe("2026-06-07");
    expect(days).toBe(7);
  });
});

describe("series helpers", () => {
  it("increments and converts to points", () => {
    const series = emptySeries(["2026-06-01", "2026-06-02"], ["count"]);
    incrementSeries(series, "2026-06-01", "count", 2);
    incrementSeries(series, "2026-06-02", "count", 1);
    expect(seriesToPoints(series, ["2026-06-01", "2026-06-02"])).toEqual([
      { date: "2026-06-01", values: { count: 2 } },
      { date: "2026-06-02", values: { count: 1 } },
    ]);
  });
});

describe("computeKpiSnapshot", () => {
  it("computes today, yesterday, and 7d average", () => {
    const map = new Map([
      ["2026-06-13", 1],
      ["2026-06-14", 2],
      ["2026-06-15", 4],
    ]);
    expect(computeKpiSnapshot(map, "2026-06-15")).toEqual({
      today: 4,
      yesterday: 2,
      avg7d: 1,
    });
  });
});
