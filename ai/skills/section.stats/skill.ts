import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.stats",
  description:
    "Generate a statistics/metrics section with large numbers, labels, and optional animated counter effect using Intersection Observer.",
  category: "section",
  examples: [
    "核心指标展示：4个大数字，带滚动计数动画",
    "成就数据：用户数、处理量、满意度等",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - stats",
    intent: "string - what metrics to showcase",
    contentHints: "string - metric names, numbers, units",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.stats/prompt.md",
  tools: ["write_file", "format_code"],
};
