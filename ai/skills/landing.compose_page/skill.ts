import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "landing.compose_page",
  description: "Compose the final page.tsx by importing and assembling all generated section components in order",
  category: "landing",
  examples: [
    "组合所有区块生成最终页面",
    "生成 page.tsx 导入并排列所有 sections",
  ],
  inputSchema: {
    pageTitle: "string - page title",
    sections: "array - list of section fileNames in order",
    designSystem: "string - design system doc (for global page-level effects like scanlines)",
  },
  prompt: "landing.compose_page/prompt.md",
  promptVersion: "v1",
  tools: ["write_file", "format_code"],
};
