import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractContent } from "../shared/llm";
import { getModelForStep } from "@/lib/config/models";
import {
  buildSectionImportPath,
  buildScreenImportPath,
  slugToPagePath,
} from "../shared/paths";
import type { PlannedPageBlueprint, PlannedSectionSpec } from "../types";

export interface ComposePageOptions {
  appScreenComponentName?: string;
}

export async function stepComposePage(
  blueprint: PlannedPageBlueprint,
  designSystem: string,
  pageSections: PlannedSectionSpec[],
  options?: ComposePageOptions
): Promise<string> {
  const targetPagePath = slugToPagePath(blueprint.slug);
  if (options?.appScreenComponentName) {
    const appScreenImportPath = buildScreenImportPath(blueprint.slug);
    const tsx = `import type { Metadata } from "next";
import ${options.appScreenComponentName} from "${appScreenImportPath}";

export const metadata: Metadata = {
  title: "${blueprint.title}",
  description: "${blueprint.description}",
};

export default function Page() {
  return (
    <main className="relative min-h-screen bg-background">
      <${options.appScreenComponentName} />
    </main>
  );
}
`;
    await writeSiteFile(targetPagePath, tsx);
    await formatSiteFile(targetPagePath);
    return targetPagePath;
  }

  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("composePage"),
    loadGuardrail("outputTsx"),
  ]);

  const importStatements = pageSections
    .map(
      (section) =>
        `import ${section.fileName} from "${buildSectionImportPath(blueprint.slug, section.fileName)}";`
    )
    .join("\n");

  const userMessage = `## Target Page Path
${targetPagePath}

## Page Title
${blueprint.title}

## Page Description
${blueprint.description}

## Product Mapping
- **Journey Stage**: ${blueprint.journeyStage}

## Import Statements
${importStatements}

## Content Sections to Compose (in order, navigation and footer are in layout.tsx — do NOT include them)
${pageSections.map((section, index) => `${index + 1}. ${section.fileName}`).join("\n")}

## Design System (tokens and tone — not a mandate for overlays)
${designSystem}

Generate the page component source for this page route.
Treat the page design plan as the composition strategy, not just a list of imports.
Do not add scanlines, grain, dot grids, or other decorative full-viewport layers unless a **Page Constraint** or **Layout Strategy** line above explicitly requests that effect.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.3, undefined, getModelForStep("compose_page"));
  let tsx = extractContent(raw, "tsx");

  // Post-process: ensure import paths match the actual generated files.
  // LLM sometimes ignores the provided import statements and invents its own paths.
  for (const section of pageSections) {
    const correctPath = buildSectionImportPath(blueprint.slug, section.fileName);
    tsx = tsx.replace(
      new RegExp(`import\\s+${section.fileName}\\s+from\\s+["'][^"']+["']`, "g"),
      `import ${section.fileName} from "${correctPath}"`
    );
  }

  // Deduplicate import lines — LLM sometimes emits the same import twice.
  const lines = tsx.split("\n");
  const seenImports = new Set<string>();
  const deduped: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^import\s+\w+\s+from\s+["']/.test(trimmed)) {
      if (seenImports.has(trimmed)) continue; // skip duplicate
      seenImports.add(trimmed);
    }
    deduped.push(line);
  }
  tsx = deduped.join("\n");

  // Safety check: if LLM inlined components, duplicated components, or missed imports — rebuild.
  const hasExpectedImports = pageSections.every((s) =>
    tsx.includes(`from "${buildSectionImportPath(blueprint.slug, s.fileName)}"`)
  );
  const hasInlinedComponents = pageSections.some((s) =>
    new RegExp(`(const|function)\\s+${s.fileName}\\s*[=(]`).test(tsx)
  );
  const hasDuplicateRenders = pageSections.some((s) => {
    const matches = tsx.match(new RegExp(`<${s.fileName}\\s*/?>`, "g"));
    return matches && matches.length > 1;
  });

  if (!hasExpectedImports || hasInlinedComponents || hasDuplicateRenders) {
    // Rebuild a minimal but correct page
    const imports = pageSections
      .map((s) => `import ${s.fileName} from "${buildSectionImportPath(blueprint.slug, s.fileName)}";`)
      .join("\n");
    const renders = pageSections.map((s) => `        <${s.fileName} />`).join("\n");
    tsx = `import type { Metadata } from "next";
${imports}

export const metadata: Metadata = {
  title: "${blueprint.title}",
  description: "${blueprint.description}",
};

export default function Page() {
  return (
    <main className="relative min-h-screen bg-background">
${renders}
    </main>
  );
}
`;
  }

  await writeSiteFile(targetPagePath, tsx);
  await formatSiteFile(targetPagePath);

  return targetPagePath;
}
