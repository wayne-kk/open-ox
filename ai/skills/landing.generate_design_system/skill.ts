import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "landing.generate_design_system",
  description: "Generate a complete Design System document (tokens, typography, components, effects) based on design intent",
  category: "landing",
  examples: [
    "生成赛博朋克风格的设计系统",
    "为万圣节活动页面创建设计规范",
    "生成极简主义设计系统",
  ],
  inputSchema: {
    designIntent: "object - mood, colorDirection, style, keywords from PageBlueprint",
    pageTitle: "string - the page title for context",
  },
  prompt: "landing.generate_design_system/prompt.md",
  promptVersion: "v1",
  tools: ["write_file"],
};
