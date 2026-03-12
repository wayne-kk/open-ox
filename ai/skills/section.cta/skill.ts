import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.cta",
  description:
    "Generate a full-width call-to-action section with high-contrast background, compelling headline, urgency copy, and primary CTA button. Supports gradient/neon/dark-panel variants.",
  category: "section",
  examples: [
    "强 CTA 横幅：暗色背景，neon 文字发光，限时优惠倒计时",
    "SaaS 免费试用横幅：渐变背景，大标题，输入框+按钮",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - cta",
    intent: "string - conversion goal and urgency message",
    contentHints: "string - headline, subtext, button copy",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.cta/prompt.md",
  tools: ["write_file", "format_code"],
};
