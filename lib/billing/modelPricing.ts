import {
  DEFAULT_MODEL_TOKEN_PRICE,
  getAllModels,
  type ModelTokenPrice,
} from "@/lib/config/models";

/** Token prices come from the shared model configuration. */

export type TokenPrice = ModelTokenPrice;

export function resolveModelPrice(modelId: string): TokenPrice {
  const id = modelId.trim().toLowerCase();
  if (!id) return DEFAULT_MODEL_TOKEN_PRICE;
  const model = getAllModels().find((candidate) => candidate.id.trim().toLowerCase() === id);
  return model?.tokenPrice ?? DEFAULT_MODEL_TOKEN_PRICE;
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
