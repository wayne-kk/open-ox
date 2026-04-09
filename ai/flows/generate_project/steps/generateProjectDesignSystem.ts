import { loadStepPrompt, loadSystem, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";
import type { ProjectBlueprint } from "../types";

export async function stepGenerateProjectDesignSystem(
  blueprint: ProjectBlueprint,
  styleGuide?: string
): Promise<string> {
  const systemPrompt = [
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const userMessage = `## ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Design Intent
- Mood: ${blueprint.experience.designIntent.mood.join(", ")}
- Color Direction: ${blueprint.experience.designIntent.colorDirection}
- Style: ${blueprint.experience.designIntent.style}
- Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}

`;

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
