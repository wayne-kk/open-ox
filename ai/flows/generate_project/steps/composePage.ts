import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { callLLMWithMeta, extractContent } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { getModelForStep } from "@/lib/config/models";
import { buildSectionImportPath, slugToPagePath } from "../shared/paths";
import type { PlannedPageBlueprint, PlannedSectionSpec, StepTrace } from "../types";

export interface ComposePageOptions {
  /** Web whole-page: root layout has no global nav/footer; one section contains the full shell. */
  wholePage?: boolean;
}

export interface ComposePageResult {
  pagePath: string;
  /** Present when the page body was produced by an LLM call */
  trace?: StepTrace;
}

export async function stepComposePage(
  blueprint: PlannedPageBlueprint,
  designSystem: string,
  pageSections: PlannedSectionSpec[],
  options?: ComposePageOptions
): Promise<ComposePageResult> {
  const targetPagePath = slugToPagePath(blueprint.slug);

  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt(options?.wholePage ? "composePage.wholePage" : "composePage"),
    loadGuardrail("outputTsx"),
    loadGuardrail("framerMotionVariants"),
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

## Content Sections to Compose (in order)
${
  options?.wholePage
    ? "Whole-page: the listed section(s) include the in-page shell; root layout has no global nav/footer components."
    : "Navigation and footer are in `app/layout.tsx` — do NOT duplicate them in `page.tsx`."
}
${pageSections.map((section, index) => `${index + 1}. ${section.fileName}`).join("\n")}

## Design System (tokens and tone — not a mandate for overlays)
${designSystem}

Generate the page component source for this page route.
Treat the page design plan as the composition strategy, not just a list of imports.
Do not add scanlines, grain, dot grids, or other decorative full-viewport layers unless a **Page Constraint** or **Layout Strategy** line above explicitly requests that effect.`;

  const composeModel = getModelForStep("compose_page");
  const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.3, undefined, composeModel);
  const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
  let tsx = extractContent(meta.content, "tsx");

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

  return { pagePath: targetPagePath, trace };
}
