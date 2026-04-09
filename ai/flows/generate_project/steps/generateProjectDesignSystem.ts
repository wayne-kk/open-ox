import { loadStepPrompt, loadSystem, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";
import type { DesignIntent } from "../types";

export async function stepGenerateProjectDesignSystem(
  designIntent: DesignIntent,
  styleGuide?: string
): Promise<string> {
  const systemPrompt = [
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const userMessage = `## Design Intent
- Mood: ${designIntent.mood.join(", ")}
- Color Direction: ${designIntent.colorDirection}
- Style: ${designIntent.style}
- Keywords: ${designIntent.keywords.join(", ")}

`;

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
