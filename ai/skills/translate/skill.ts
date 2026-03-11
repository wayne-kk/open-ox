import type { SkillMetadata } from "../../types";

export const skill: SkillMetadata = {
  name: "translate",
  description: "Translate text between languages",
  category: "writing",
  examples: ["翻译成英文", "把这段翻译成中文", "translate to Japanese"],
  inputSchema: {
    content: "string - the text to translate",
    targetLang: "string - target language code (e.g. en, zh)",
  },
  prompt: "translate/prompt.md",
  promptVersion: "v1",
  tools: [],
};
