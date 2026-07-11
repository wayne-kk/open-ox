import { describe, expect, it } from "vitest";
import { resolveModelPrice, tokensToUsd } from "./modelPricing";
import { runWithUsageAccounting, recordLlmUsage } from "./usageContext";
import { usdToCredits } from "./credits";

describe("modelPricing", () => {
  it("resolves known model prefixes", () => {
    expect(resolveModelPrice("gemini-3-flash-preview").inputPerMTok).toBe(0.15);
    expect(resolveModelPrice("gpt-5.2").outputPerMTok).toBe(14);
  });

  it("falls back for unknown models", () => {
    expect(resolveModelPrice("mystery-model-9").inputPerMTok).toBe(0.5);
  });

  it("computes USD from tokens", () => {
    // 1M input @ 0.15 + 1M output @ 0.6 = 0.75
    const usd = tokensToUsd({
      modelId: "gemini-3-flash-preview",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(0.75, 6);
  });
});

describe("usageContext", () => {
  it("accumulates nested LLM calls into credits", async () => {
    const { result, usage } = await runWithUsageAccounting(async () => {
      recordLlmUsage({
        modelId: "gemini-3-flash-preview",
        inputTokens: 1_000_000,
        outputTokens: 0,
      });
      recordLlmUsage({
        modelId: "gemini-3-flash-preview",
        inputTokens: 0,
        outputTokens: 1_000_000,
      });
      return "ok";
    });
    expect(result).toBe("ok");
    expect(usage.totalInputTokens).toBe(1_000_000);
    expect(usage.totalOutputTokens).toBe(1_000_000);
    expect(usage.totalUsd).toBeCloseTo(0.75, 6);
    expect(usage.totalCredits).toBe(usdToCredits(0.75));
  });

  it("no-ops record outside accounting scope", () => {
    expect(() =>
      recordLlmUsage({ modelId: "x", inputTokens: 10, outputTokens: 10 })
    ).not.toThrow();
  });
});
