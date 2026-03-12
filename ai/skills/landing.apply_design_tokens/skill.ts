import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "landing.apply_design_tokens",
  description: "Apply design system tokens to globals.css and tailwind.config.ts, generating updated file contents",
  category: "landing",
  examples: [
    "将赛博朋克设计系统应用到 CSS 变量",
    "更新 tailwind 配置以支持自定义设计 token",
  ],
  inputSchema: {
    designSystem: "string - full design system document",
    currentGlobalsCss: "string - current content of globals.css",
    currentTailwindConfig: "string - current content of tailwind.config.ts",
  },
  prompt: "landing.apply_design_tokens/prompt.md",
  promptVersion: "v1",
  tools: ["write_file"],
};
