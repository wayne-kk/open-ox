import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.hero",
  description:
    "Generate a visually striking hero section with headline, subheading, CTA buttons, and dynamic background effects. Supports split layout (60/40), full-bleed centered layout, and parallax variants.",
  category: "section",
  examples: [
    "万圣节首屏，暗色系，骷髅主视觉，强烈 CTA",
    "SaaS 产品首屏，分屏布局，动态代码背景",
    "音乐节首屏，霓虹灯光，全屏视频背景感",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - hero",
    intent: "string - section's goal and visual direction",
    contentHints: "string - headline, subheading, CTA copy suggestions",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.hero/prompt.md",
  tools: ["write_file", "format_code"],
};
