import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.features",
  description:
    "Generate a features/benefits grid section with icon cards, hover effects, and optional highlighted feature variant. Supports 3-col, 2-col+side-text, and bento-grid layouts.",
  category: "section",
  examples: [
    "核心功能展示：3列图标卡片，暗色卡片边框发光效果",
    "产品特性：2列布局，左侧大图，右侧功能列表",
    "Bento grid 混合尺寸特性展示",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - features",
    intent: "string - what features/benefits to highlight",
    contentHints: "string - feature names, descriptions, icons",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.features/prompt.md",
  tools: ["write_file", "format_code"],
};
