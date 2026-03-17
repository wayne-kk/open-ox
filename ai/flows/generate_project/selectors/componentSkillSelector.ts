import { hasSkillPrompt } from "../shared/files";
import type { PlannedSectionSpec, ProductScope } from "../types";

/**
 * Maps section type + design context to an optional component skill ID.
 * Component skills provide rich, section-specific design guidance beyond
 * the generic section prompts. They are selected when conditions match.
 */
export const COMPONENT_SKILL_IDS: Record<string, string[]> = {
  hero: [
    "component.hero.impactful", // High-impact, modern hero patterns
    "component.hero.editorial", // Story-forward, premium editorial
    "component.hero.dashboard", // Product-led, metrics-focused
  ],
};

/**
 * Selects a component skill ID for the given section when conditions match.
 * Returns the first matching skill that exists on disk, or null if none apply.
 */
export function selectComponentSkillId(params: {
  section: PlannedSectionSpec;
  productScope?: ProductScope;
}): string | null {
  const { section } = params;
  const candidates = COMPONENT_SKILL_IDS[section.type];
  if (!candidates?.length) {
    return null;
  }

  const assistIds = new Set(section.designPlan?.capabilityAssistIds ?? []);

  // Hero: prefer skill that aligns with already-selected layout/capability pattern
  if (section.type === "hero") {
    if (assistIds.has("pattern.hero.editorial") && hasSkillPrompt("component.hero.editorial")) {
      return "component.hero.editorial";
    }
    if (assistIds.has("pattern.hero.dashboard") && hasSkillPrompt("component.hero.dashboard")) {
      return "component.hero.dashboard";
    }
    // Default: impactful for high-impact design (most heroes)
    if (hasSkillPrompt("component.hero.impactful")) {
      return "component.hero.impactful";
    }
  }

  return null;
}
