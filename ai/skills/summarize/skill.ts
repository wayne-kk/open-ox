import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "summarize",
  description: "Summarize long text into concise key points",
  category: "writing",
  examples: ["帮我总结这篇文章", "总结会议纪要", "概括这段内容"],
  inputSchema: {
    content: "string - the text to summarize",
  },
  prompt: "summarize/prompt.md",
  promptVersion: "v1",
  tools: [],
};
