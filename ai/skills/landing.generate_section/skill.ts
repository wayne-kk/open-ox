import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "landing.generate_section",
  description: "Generate a single self-contained React section component following the site's design system",
  category: "landing",
  examples: [
    "生成 Hero 区块组件",
    "创建 Features 功能列表区块",
    "生成定价方案区块",
  ],
  inputSchema: {
    designSystem: "string - full design system document",
    sectionType: "string - section type (hero, features, pricing, etc.)",
    intent: "string - what this section communicates",
    contentHints: "string - what content and UI elements are needed",
    fileName: "string - component filename without extension (e.g. HeroSection)",
  },
  prompt: "landing.generate_section/prompt.md",
  promptVersion: "v1",
  tools: ["write_file", "format_code"],
};
