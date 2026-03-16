import { hasSectionPrompt } from "../shared/files";

export const SECTION_PROMPT_IDS: Record<string, string> = {
  navigation: "section.navigation",
  hero: "section.hero",
  features: "section.features",
  pricing: "section.pricing",
  cta: "section.cta",
  footer: "section.footer",
  stats: "section.stats",
  testimonials: "section.testimonials",
  faq: "section.faq",
};

export function selectSectionPromptId(sectionType: string): string {
  const promptId = SECTION_PROMPT_IDS[sectionType];
  if (!promptId) {
    return "section.default";
  }

  return hasSectionPrompt(promptId) ? promptId : "section.default";
}
