import { loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";
import { getModelForStep } from "@/lib/config/models";

export async function stepGenerateProjectDesignSystem(
  designIntentMarkdown: string,
  styleGuide?: string
): Promise<string> {
  const systemPrompt = [
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const userMessage = designIntentMarkdown + (styleGuide ? `\n\n## Style Guide\n${styleGuide}` : "");

  const designSystem = await callLLM(
    systemPrompt,
    userMessage,
    0.8,
    undefined,
    getModelForStep("generate_project_design_system")
  );
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
