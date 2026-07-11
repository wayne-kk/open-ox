import { AsyncLocalStorage } from "node:async_hooks";
import { usdToCredits } from "./credits";
import { tokensToUsd } from "./modelPricing";

export type LlmUsageEvent = {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
};

export type AccumulatedUsage = {
  events: LlmUsageEvent[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalUsd: number;
  totalCredits: number;
};

class UsageAccumulator {
  readonly events: LlmUsageEvent[] = [];

  add(event: LlmUsageEvent): void {
    const inputTokens = Math.max(0, Math.floor(event.inputTokens) || 0);
    const outputTokens = Math.max(0, Math.floor(event.outputTokens) || 0);
    if (inputTokens === 0 && outputTokens === 0) return;
    this.events.push({
      modelId: event.modelId,
      inputTokens,
      outputTokens,
    });
  }

  snapshot(): AccumulatedUsage {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalUsd = 0;
    for (const e of this.events) {
      totalInputTokens += e.inputTokens;
      totalOutputTokens += e.outputTokens;
      totalUsd += tokensToUsd(e);
    }
    return {
      events: [...this.events],
      totalInputTokens,
      totalOutputTokens,
      totalUsd,
      totalCredits: usdToCredits(totalUsd),
    };
  }
}

const usageStore = new AsyncLocalStorage<UsageAccumulator>();

/** Record one LLM call into the active run accumulator (no-op if none). */
export function recordLlmUsage(event: LlmUsageEvent): void {
  usageStore.getStore()?.add(event);
}

/**
 * Run `fn` with a fresh usage accumulator. Returns result + snapshot.
 * Nested calls reuse the outer accumulator (do not nest new stores).
 */
export async function runWithUsageAccounting<T>(
  fn: () => Promise<T>
): Promise<{ result: T; usage: AccumulatedUsage }> {
  const existing = usageStore.getStore();
  if (existing) {
    const result = await fn();
    return { result, usage: existing.snapshot() };
  }
  const acc = new UsageAccumulator();
  const result = await usageStore.run(acc, fn);
  return { result, usage: acc.snapshot() };
}

export function getActiveUsageSnapshot(): AccumulatedUsage | null {
  const acc = usageStore.getStore();
  return acc ? acc.snapshot() : null;
}
