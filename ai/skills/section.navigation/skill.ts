import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.navigation",
  description:
    "Generate a sticky top navigation bar with logo, nav links, CTA button, mobile hamburger menu, and optional scroll-aware background transition.",
  category: "section",
  examples: [
    "固定顶部导航：Logo + 导航链接 + CTA按钮，移动端汉堡菜单",
    "透明导航栏，滚动后变为实色背景+毛玻璃效果",
    "深色主题导航，带霓虹边框底线，移动端抽屉菜单",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - navigation",
    intent: "string - navbar style and key links",
    contentHints: "string - brand name, nav link labels, CTA copy",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.navigation/prompt.md",
  tools: ["write_file", "format_code"],
};
