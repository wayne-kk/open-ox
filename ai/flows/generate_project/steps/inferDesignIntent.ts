import { composePromptBlocks, loadStepPrompt } from "../shared/files";
import { callLLM } from "../shared/llm";
import { writeSiteFile } from "../shared/files";
import { getModelForStep } from "@/lib/config/models";

/**
 * Infer design intent from user input.
 * Returns a markdown text (not JSON) that serves as the visual blueprint
 * for downstream design system generation.
 * Also saves the output as design-intent.md in the project directory.
 */
export async function stepInferDesignIntent(
  userInput: string
): Promise<string> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("inferDesignIntent"),
  ]);

  const userMessage = `## User Requirement
${userInput}`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0.4,
      undefined,
      getModelForStep("infer_design_intent")
    );
    const result = raw.trim();
    if (result) {
      await writeSiteFile("design-intent.md", result);
    }
    return result;
  } catch {
    return "";
  }
}
