import { loadPrompt } from "@/ai/prompts/core";

export const SYSTEM_PROMPT = loadPrompt("modify-system", "modifyAgent");
export const READ_ONLY_SYSTEM_PROMPT = loadPrompt("modify-system", "modifyAgentReadOnly");
