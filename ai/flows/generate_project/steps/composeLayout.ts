import {
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

  const beforeSections = layoutSections.filter(
    (section) => section.designPlan.shellPlacement === "beforePageContent"
  );
  const afterSections = layoutSections.filter(
    (section) => section.designPlan.shellPlacement !== "beforePageContent"
  );
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
- Role: ${section.designPlan.role}
- Goal: ${section.designPlan.goal}
- Shell Placement: ${section.designPlan.shellPlacement ?? "afterPageContent"}
- Layout Intent: ${section.designPlan.layoutIntent}
- Visual Intent: ${section.designPlan.visualIntent}`
  )
  .join("\n\n")}

## Instructions
1. Add the import statements above to the existing imports (do not duplicate if already present)
2. Render these sections before {children}, in order: ${renderList(beforeSections)}
3. Render these sections after {children}, in order: ${renderList(afterSections)}
4. Preserve ALL existing content: metadata, font setup, className on <html>/<body>, etc.
5. Do not hardcode assumptions about only navigation/footer existing; respect the provided section list and order.
6. Output ONLY the complete updated layout.tsx — no markdown fences, no explanation
7. Project: ${blueprint.brief.projectTitle}`;

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("composeLayout"),
    "\n\n",
    loadGuardrail("outputTsx"),
  ].join("");
  const raw = await callLLM(systemPrompt, userMessage, 0.2);
  const tsx = extractContent(raw, "tsx");

  await writeSiteFile("app/layout.tsx", tsx);
  await formatSiteFile("app/layout.tsx");

  return "app/layout.tsx";
}
