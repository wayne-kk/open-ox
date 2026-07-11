/**
 * Approximate public $/1M token rates for credit metering.
 * Unknown models fall back to a mid-tier default.
 */

export type TokenPrice = {
  inputPerMTok: number;
  outputPerMTok: number;
};

const DEFAULT_PRICE: TokenPrice = { inputPerMTok: 0.5, outputPerMTok: 3 };

/** Prefix / exact matches — longest prefix wins when sorted by length desc. */
const MODEL_PRICES: Array<{ match: string; price: TokenPrice }> = [
  { match: "gemini-3-flash", price: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
  { match: "gemini-3.1-pro", price: { inputPerMTok: 1.25, outputPerMTok: 5 } },
  { match: "gemini-2.5-flash", price: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
  { match: "gemini-2.5-pro", price: { inputPerMTok: 1.25, outputPerMTok: 10 } },
  { match: "gpt-5.2", price: { inputPerMTok: 1.75, outputPerMTok: 14 } },
  { match: "gpt-4o-mini", price: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
  { match: "gpt-4o", price: { inputPerMTok: 2.5, outputPerMTok: 10 } },
  { match: "claude-sonnet", price: { inputPerMTok: 3, outputPerMTok: 15 } },
  { match: "claude-haiku", price: { inputPerMTok: 0.8, outputPerMTok: 4 } },
];

export function resolveModelPrice(modelId: string): TokenPrice {
  const id = modelId.trim().toLowerCase();
  if (!id) return DEFAULT_PRICE;
  const sorted = [...MODEL_PRICES].sort((a, b) => b.match.length - a.match.length);
  for (const row of sorted) {
    if (id === row.match || id.startsWith(row.match)) return row.price;
  }
  return DEFAULT_PRICE;
}

export function tokensToUsd(params: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const price = resolveModelPrice(params.modelId);
  const input = Math.max(0, params.inputTokens);
  const output = Math.max(0, params.outputTokens);
  return (input / 1_000_000) * price.inputPerMTok + (output / 1_000_000) * price.outputPerMTok;
}
