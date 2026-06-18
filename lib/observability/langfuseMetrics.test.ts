import { describe, expect, it } from "vitest";
import { aggregateModelCosts } from "@/lib/observability/langfuseMetrics";
import type { LangfuseDailyMetric } from "@/lib/observability/langfuseMetrics";

describe("langfuseMetrics", () => {
  it("aggregates model costs across days", () => {
    const metrics: LangfuseDailyMetric[] = [
      {
        date: "2026-06-01",
        totalCost: 10,
        countTraces: 1,
        countObservations: 2,
        usage: [
          { model: "gpt-4", inputUsage: 100, outputUsage: 50, totalUsage: 150, totalCost: 6 },
          { model: "gemini", inputUsage: 200, outputUsage: 100, totalUsage: 300, totalCost: 4 },
        ],
      },
      {
        date: "2026-06-02",
        totalCost: 5,
        countTraces: 1,
        countObservations: 1,
        usage: [
          { model: "gpt-4", inputUsage: 50, outputUsage: 25, totalUsage: 75, totalCost: 5 },
        ],
      },
    ];

    expect(aggregateModelCosts(metrics)).toEqual([
      { model: "gpt-4", totalCost: 11, totalTokens: 225 },
      { model: "gemini", totalCost: 4, totalTokens: 300 },
    ]);
  });
});
