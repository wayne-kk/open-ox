/**
 * Skill Index - 集中导出所有 skills
 * 新增 skill 时在此添加 import 和 entries
 */

import type { Skill } from "../types";
import { skill as summarizeSkill } from "./summarize/skill";
import { skill as translateSkill } from "./translate/skill";
import { skill as rewriteSkill } from "./rewrite/skill";
import { skill as landingAnalyzeSkill } from "./landing.analyze_requirement/skill";
import { skill as landingDesignSystemSkill } from "./landing.generate_design_system/skill";
import { skill as landingApplyTokensSkill } from "./landing.apply_design_tokens/skill";
import { skill as landingGenerateSectionSkill } from "./landing.generate_section/skill";
import { skill as landingComposePageSkill } from "./landing.compose_page/skill";
import { skill as sectionHeroSkill } from "./section.hero/skill";
import { skill as sectionFeaturesSkill } from "./section.features/skill";
import { skill as sectionPricingSkill } from "./section.pricing/skill";
import { skill as sectionCtaSkill } from "./section.cta/skill";
import { skill as sectionFooterSkill } from "./section.footer/skill";
import { skill as sectionStatsSkill } from "./section.stats/skill";
import { skill as sectionTestimonialsSkill } from "./section.testimonials/skill";
import { skill as sectionFaqSkill } from "./section.faq/skill";
import { skill as sectionNavigationSkill } from "./section.navigation/skill";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SKILLS_BASE = join(process.cwd(), "ai", "skills");

function loadPrompt(skillName: string, version?: string): string {
  try {
    const v2 = join(SKILLS_BASE, skillName, "prompt.v2.md");
    const v1 = join(SKILLS_BASE, skillName, "prompt.md");
    const path = version === "v2" && existsSync(v2) ? v2 : v1;
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

const skillList: [string, Skill][] = [
  [
    "summarize",
    {
      ...summarizeSkill,
      promptContent: loadPrompt("summarize", summarizeSkill.promptVersion),
    },
  ],
  [
    "translate",
    {
      ...translateSkill,
      promptContent: loadPrompt("translate", translateSkill.promptVersion),
    },
  ],
  [
    "rewrite",
    {
      ...rewriteSkill,
      promptContent: loadPrompt("rewrite", rewriteSkill.promptVersion),
    },
  ],
  [
    "landing.analyze_requirement",
    {
      ...landingAnalyzeSkill,
      promptContent: loadPrompt("landing.analyze_requirement", landingAnalyzeSkill.promptVersion),
    },
  ],
  [
    "landing.generate_design_system",
    {
      ...landingDesignSystemSkill,
      promptContent: loadPrompt("landing.generate_design_system", landingDesignSystemSkill.promptVersion),
    },
  ],
  [
    "landing.apply_design_tokens",
    {
      ...landingApplyTokensSkill,
      promptContent: loadPrompt("landing.apply_design_tokens", landingApplyTokensSkill.promptVersion),
    },
  ],
  [
    "landing.generate_section",
    {
      ...landingGenerateSectionSkill,
      promptContent: loadPrompt("landing.generate_section", landingGenerateSectionSkill.promptVersion),
    },
  ],
  [
    "landing.compose_page",
    {
      ...landingComposePageSkill,
      promptContent: loadPrompt("landing.compose_page", landingComposePageSkill.promptVersion),
    },
  ],
  [
    "section.hero",
    {
      ...sectionHeroSkill,
      promptContent: loadPrompt("section.hero", sectionHeroSkill.promptVersion),
    },
  ],
  [
    "section.features",
    {
      ...sectionFeaturesSkill,
      promptContent: loadPrompt("section.features", sectionFeaturesSkill.promptVersion),
    },
  ],
  [
    "section.pricing",
    {
      ...sectionPricingSkill,
      promptContent: loadPrompt("section.pricing", sectionPricingSkill.promptVersion),
    },
  ],
  [
    "section.cta",
    {
      ...sectionCtaSkill,
      promptContent: loadPrompt("section.cta", sectionCtaSkill.promptVersion),
    },
  ],
  [
    "section.footer",
    {
      ...sectionFooterSkill,
      promptContent: loadPrompt("section.footer", sectionFooterSkill.promptVersion),
    },
  ],
  [
    "section.stats",
    {
      ...sectionStatsSkill,
      promptContent: loadPrompt("section.stats", sectionStatsSkill.promptVersion),
    },
  ],
  [
    "section.testimonials",
    {
      ...sectionTestimonialsSkill,
      promptContent: loadPrompt("section.testimonials", sectionTestimonialsSkill.promptVersion),
    },
  ],
  [
    "section.faq",
    {
      ...sectionFaqSkill,
      promptContent: loadPrompt("section.faq", sectionFaqSkill.promptVersion),
    },
  ],
  [
    "section.navigation",
    {
      ...sectionNavigationSkill,
      promptContent: loadPrompt("section.navigation", sectionNavigationSkill.promptVersion),
    },
  ],
];

export const skills = new Map<string, Skill>(skillList);
