import { loadGuardrail, loadStepPrompt, loadSystem, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";
import type { PlannedProjectBlueprint } from "../types";

export async function stepGenerateProjectDesignSystem(
  blueprint: PlannedProjectBlueprint
): Promise<string> {
  const projectGuardrails = blueprint.projectGuardrailIds
    .map((guardrailId) => loadGuardrail(guardrailId))
    .join("\n\n");
  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    projectGuardrails,
    "\n\n",
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  // Compact user message — only essential info for design system generation
  const pagesList = blueprint.site.pages
    .map((page) => `- ${page.title} (/${page.slug}): ${page.sections.map((s) => s.type).join(", ")}`)
    .join("\n");

  const userMessage = `## ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Design Intent
- Mood: ${blueprint.experience.designIntent.mood.join(", ")}
- Color Direction: ${blueprint.experience.designIntent.colorDirection}
- Style: ${blueprint.experience.designIntent.style}
- Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}

## Product Type
${blueprint.brief.productScope.productType} — ${blueprint.brief.productScope.audienceSummary}

## Pages
${pagesList}

## Layout Sections
${blueprint.site.layoutSections.map((s) => `- ${s.type}: ${s.intent}`).join("\n")}

Generate the complete shared Design System for this website project.`;

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
