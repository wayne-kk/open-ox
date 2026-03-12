import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.faq",
  description:
    "Generate an FAQ accordion section with smooth expand/collapse animation, keyboard-accessible, and optional two-column layout.",
  category: "section",
  examples: [
    "常见问题手风琴，点击展开，带平滑高度动画",
    "双列 FAQ，左侧标题，右侧手风琴列表",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - faq",
    intent: "string - what questions to address",
    contentHints: "string - question topics, objections to overcome",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.faq/prompt.md",
  tools: ["write_file", "format_code"],
};
