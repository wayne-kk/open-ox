import { loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";

export async function stepGenerateProjectDesignSystem(
  designIntentMarkdown: string,
  styleGuide?: string
): Promise<string> {
  const systemPrompt = [
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const userMessage = designIntentMarkdown + (styleGuide ? `\n\n## Style Guide\n${styleGuide}` : "");

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
