import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { extractContent, callLLM } from "../shared/llm";
import { buildSectionImportPath } from "../shared/paths";
import type { PlannedProjectBlueprint, PlannedSectionSpec } from "../types";

function isBeforePageContent(section: PlannedSectionSpec): boolean {
  return section.type === "navigation";
}

export async function stepComposeLayout(
  layoutSections: PlannedSectionSpec[],
  blueprint: PlannedProjectBlueprint
): Promise<string | null> {
  if (layoutSections.length === 0) {
    return null;
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
  ]);
  const raw = await callLLM(systemPrompt, userMessage, 0.2);
  const tsx = extractContent(raw, "tsx");

  await writeSiteFile("app/layout.tsx", tsx);
  await formatSiteFile("app/layout.tsx");

  return "app/layout.tsx";
}
