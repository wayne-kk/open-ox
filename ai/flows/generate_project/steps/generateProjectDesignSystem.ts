import { loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMeta } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type { StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

export async function stepGenerateProjectDesignSystem(
  designIntentMarkdown: string,
  styleGuide?: string
): Promise<{ designSystem: string; trace: StepTrace }> {
  const systemPrompt = [
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const userMessage = designIntentMarkdown + (styleGuide ? `\n\n## Style Guide\n${styleGuide}` : "");

  const model = getModelForStep("generate_project_design_system");
  const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.8, undefined, model);
  const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
  const designSystem = meta.content;
  await writeSiteFile("design-system.md", designSystem);
  return { designSystem, trace };
}
