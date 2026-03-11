import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "rewrite",
  description: "Rewrite text with different style or tone",
  category: "writing",
  examples: ["改写得更正式", "用口语化重写", "make it more concise"],
  inputSchema: {
    content: "string - the text to rewrite",
    style: "string - desired style (formal, casual, concise, etc.)",
  },
  prompt: "rewrite/prompt.md",
  promptVersion: "v1",
  tools: [],
};
