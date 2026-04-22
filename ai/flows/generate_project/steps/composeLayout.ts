import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { extractContent, callLLMWithMeta } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { buildSectionImportPath } from "../shared/paths";
import type { PlannedProjectBlueprint, PlannedSectionSpec, StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

function isBeforePageContent(section: PlannedSectionSpec): boolean {
  return section.type === "navigation";
}

export interface ComposeLayoutResult {
  layoutPath: string | null;
  trace?: StepTrace;
}

export async function stepComposeLayout(
  layoutSections: PlannedSectionSpec[],
  blueprint: PlannedProjectBlueprint
): Promise<ComposeLayoutResult> {
  if (layoutSections.length === 0) {
    return { layoutPath: null };
  }

  const currentLayout = readSiteFile("app/layout.tsx");
  const imports = layoutSections
    .map(
      (section) =>
        `import ${section.fileName} from "${buildSectionImportPath("layout", section.fileName)}";`
    )
    .join("\n");

  const beforeSections = layoutSections.filter(isBeforePageContent);
  const afterSections = layoutSections.filter((s) => !isBeforePageContent(s));
  const renderList = (sections: PlannedSectionSpec[]) =>
    sections.length > 0
      ? sections.map((section) => `<${section.fileName} />`).join(", ")
      : "none";

  const userMessage = `Update the existing Next.js \`app/layout.tsx\` to add the generated global layout section components.

## Current layout.tsx
\`\`\`tsx
${currentLayout}
\`\`\`

## Components to inject
${imports}

## Layout Section Design Briefs
${layoutSections
  .map(
    (section) => `### ${section.fileName}
- Type: ${section.type}
- Intent: ${section.intent}
- Placement: ${isBeforePageContent(section) ? "beforePageContent" : "afterPageContent"}`
  )
  .join("\n\n")}

## Instructions
1. Add the import statements above to the existing imports (do not duplicate if already present)
2. Render these sections before {children}, in order: ${renderList(beforeSections)}
3. Render these sections after {children}, in order: ${renderList(afterSections)}
4. Preserve ALL existing content: metadata, font setup, className on <html>/<body>, etc.
5. Do not hardcode assumptions about only navigation/footer existing; respect the provided section list and order.
6. Output ONLY the complete updated layout.tsx — no markdown fences, no explanation
7. Project: ${blueprint.brief.projectTitle}
8. **Set the \`lang\` attribute on the \`<html>\` tag to: \`${blueprint.brief.language}\`** — this is the detected language of the website content.`;

  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("composeLayout"),
    loadGuardrail("outputTsx"),
    loadGuardrail("framerMotionVariants"),
  ]);
  const layoutModel = getModelForStep("compose_page");
  const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.2, undefined, layoutModel);
  const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
  const tsx = extractContent(meta.content, "tsx");

  await writeSiteFile("app/layout.tsx", tsx);
  await formatSiteFile("app/layout.tsx");

  return { layoutPath: "app/layout.tsx", trace };
}
