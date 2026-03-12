import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "section.footer",
  description:
    "Generate a site footer with brand identity, multi-column navigation links, social media icons, copyright, and optional newsletter signup.",
  category: "section",
  examples: [
    "4列页脚：品牌Logo+简介，产品链接，资源链接，社交图标",
    "简约页脚：品牌居中，社交图标，版权信息",
  ],
  inputSchema: {
    designSystem: "string - full design system markdown",
    sectionType: "string - footer",
    intent: "string - footer content and brand tone",
    contentHints: "string - brand name, nav categories, social links",
    fileName: "string - PascalCase component name",
  },
  prompt: "section.footer/prompt.md",
  tools: ["write_file", "format_code"],
};
