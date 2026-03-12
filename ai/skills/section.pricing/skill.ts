import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.pricing",
  description:
    "Generate a pricing section with tiered plan cards, highlighted recommended plan, feature comparison list, and optional monthly/yearly toggle.",
  category: "section",
  examples: [
    "SaaS 三档定价，中间档高亮，含年付折扣 toggle",
    "简单双档定价，免费 vs 付费",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - pricing",
    intent: "string - pricing strategy and target audience",
    contentHints: "string - plan names, prices, key features per plan",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.pricing/prompt.md",
  tools: ["write_file", "format_code"],
};
