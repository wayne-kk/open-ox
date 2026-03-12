import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.testimonials",
  description:
    "Generate a testimonials/social proof section with quote cards, user avatars, star ratings, and optional masonry or carousel layout.",
  category: "section",
  examples: [
    "用户评价：3列卡片，带头像、姓名、职位、星级",
    "无限滚动 Marquee 评价走马灯效果",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - testimonials",
    intent: "string - what trust/social proof to establish",
    contentHints: "string - reviewer names, roles, companies, quote themes",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.testimonials/prompt.md",
  tools: ["write_file", "format_code"],
};
