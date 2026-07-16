import type { ProjectBlueprint } from "../types";

/**
 * Apply visual keywords before plan_project so Plan never sees SaaS filler defaults.
 * Priority: user-confirmed Studio vibe keywords → infer_design_intent keywords → keep existing (if any).
 */
export function applyDesignKeywordsBeforePlan(
  blueprint: ProjectBlueprint,
  options: {
    confirmedKeywords?: string[];
    inferredKeywords?: string[];
  }
): ProjectBlueprint {
  const confirmed = (options.confirmedKeywords ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const inferred = (options.inferredKeywords ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const keywords =
    confirmed.length > 0
      ? [...new Set(confirmed)]
      : inferred.length > 0
        ? [...new Set(inferred)]
        : (blueprint.experience?.designIntent?.keywords ?? [])
            .map((k) => k.trim())
            .filter(Boolean);

  const prev = blueprint.experience?.designIntent;
  return {
    ...blueprint,
    experience: {
      designIntent: {
        mood: prev?.mood ?? [],
        colorDirection: prev?.colorDirection ?? "",
        style: prev?.style ?? "",
        keywords,
      },
    },
  };
}

/** SaaS filler pack that must never appear as silent defaults. */
export const SAAS_DEFAULT_KEYWORD_PACK = [
  "clean",
  "professional",
  "focused",
  "confident",
  "modern",
] as const;

export function isSaasDefaultKeywordPack(keywords: string[]): boolean {
  if (keywords.length !== SAAS_DEFAULT_KEYWORD_PACK.length) return false;
  const set = new Set(keywords.map((k) => k.trim().toLowerCase()));
  return SAAS_DEFAULT_KEYWORD_PACK.every((k) => set.has(k));
}
