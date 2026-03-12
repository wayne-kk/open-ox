import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "landing.analyze_requirement",
  description: "Analyze user's website request and produce a structured PageBlueprint with sections and design intent",
  category: "landing",
  examples: [
    "我想搭建一个万圣节宣传页面",
    "帮我做一个 SaaS 产品落地页",
    "创建一个极简风格的个人作品集网站",
  ],
  inputSchema: {
    request: "string - user's natural language description of the desired website",
  },
  prompt: "landing.analyze_requirement/prompt.md",
  promptVersion: "v1",
  tools: [],
};
