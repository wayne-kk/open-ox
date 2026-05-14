import {
  loadStepPrompt,
  loadSystem,
} from "../shared/files";
import { callLLMWithTools } from "../shared/llm";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import { getModelForStep } from "@/lib/config/models";
import type {
  BuildRepairResult,
  PlannedProjectBlueprint,
} from "../types";
import { tryTypeScriptCodeFixUntilResolved } from "../shared/tsxDiagnostics";

interface RepairBuildParams {
  blueprint: PlannedProjectBlueprint;
  buildOutput: string;
  generatedFiles: string[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function selectRepairTargets(buildOutput: string, generatedFiles: string[]): string[] {
  const lowered = buildOutput.toLowerCase();
  const lowerFiles = generatedFiles.map((path) => path.toLowerCase());

  // Next.js prerender failures on "/_not-found" usually map to app/not-found.tsx.
  // Prioritize these files so repair agent edits the right place first.
  if (lowered.includes('"/_not-found"') || lowered.includes("/_not-found")) {
    const notFoundCandidates = generatedFiles.filter((path, idx) => {
      const lp = lowerFiles[idx];
      return (
        lp === "app/not-found.tsx" ||
        lp === "app/global-error.tsx" ||
        lp === "app/error.tsx"
      );
    });
    if (notFoundCandidates.length > 0) {
      return unique(notFoundCandidates).slice(0, 3);
    }
  }

  const matched = generatedFiles.filter((path) => {
    const fileName = path.split("/").pop()?.toLowerCase() ?? "";
    return lowered.includes(path.toLowerCase()) || (fileName && lowered.includes(fileName));
  });

  if (matched.length > 0) {
    return unique(matched).slice(0, 3);
  }

  const preferred = generatedFiles.filter(
    (path) =>
      path === "app/layout.tsx" ||
      path === "app/page.tsx" ||
      path === "app/not-found.tsx" ||
      path === "app/error.tsx" ||
      path === "app/global-error.tsx" ||
      path.includes("components/sections/")
  );

  return unique(preferred.length > 0 ? preferred : generatedFiles).slice(-3);
}

/** Repair tools: read → apply_workspace_edits (preferred) → edit fallback; read_lints. */
const REPAIR_TOOLS = [
  "read_file",
  "apply_workspace_edits",
  "edit_file",
  "write_file",
  "read_lints",
];

export async function stepRepairBuild({
  blueprint,
  buildOutput,
  generatedFiles,
}: RepairBuildParams): Promise<BuildRepairResult> {
  const allowedFiles = selectRepairTargets(buildOutput, generatedFiles);
  if (allowedFiles.length === 0) {
    return {
      success: false,
      output: "repair_build: no candidate files available for repair",
      touchedFiles: [],
    };
  }

  const codeFixOutcome = await tryTypeScriptCodeFixUntilResolved(generatedFiles, 25);
  const touchedFromCodeFix = [...codeFixOutcome.touchedFiles];

  if (codeFixOutcome.resolved) {
    return {
      success: true,
      output:
        `repair_build: TypeScript language-service fixes cleared diagnostics (${touchedFromCodeFix.join(", ") || "workspace"})`,
      touchedFiles: touchedFromCodeFix,
    };
  }

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("repairBuild"),
  ].join("");

  const userMessage = `## Project
${blueprint.brief.projectTitle}

## Build Failure
\`\`\`
${buildOutput}
\`\`\`

## Likely Files (read these first, then edit only what's needed)
${allowedFiles.map((path) => `- ${path}`).join("\n")}

## All Generated Files
${generatedFiles.map((path) => `- ${path}`).join("\n")}

Fix the build error using **apply_workspace_edits** with 0-based lines/characters from read_file (\`N:\` prefix → line index is N-1) and **base_content_hash** from read_file meta.contentHash. Prefer that over edit_file. Use the smallest possible edits. Start by reading failing file(s).`;

  const tools = getSystemToolDefinitions(REPAIR_TOOLS);
  const touchedFromTools = new Set<string>();
  touchedFromCodeFix.forEach((f) => touchedFromTools.add(f));

  try {
    const { toolCalls } = await callLLMWithTools({
      systemPrompt,
      userMessage,
      tools,
      temperature: 0.1,
      maxIterations: 10,
      model: getModelForStep("repair_build"),
      langfusePhase: LfToolPhase.repairBuild,
    });

    for (const tc of toolCalls) {
      if ((tc.name === "edit_file" || tc.name === "write_file") && tc.args.path) {
        const result = typeof tc.result === "object" ? tc.result : { success: true };
        if (result.success) {
          touchedFromTools.add(tc.args.path as string);
        }
      }
      if (tc.name === "apply_workspace_edits" && tc.args.path) {
        const result = typeof tc.result === "object" ? tc.result : { success: false };
        if (result.success) {
          touchedFromTools.add(tc.args.path as string);
        }
      }
    }

    const touchedFiles = Array.from(touchedFromTools);

    if (touchedFiles.length === 0) {
      return {
        success: false,
        output: "repair_build: agent made no successful edits",
        touchedFiles: [],
      };
    }

    return {
      success: true,
      output:
        touchedFromCodeFix.length > 0
          ? `repair_build: typescript code fixes and/or patches (${touchedFiles.length} file(s))`
          : `repair_build: patched ${touchedFiles.length} file(s) via tool calls`,
      touchedFiles,
    };
  } catch (error) {
    const fromCf = touchedFromCodeFix.length > 0;
    return {
      success: fromCf,
      output:
        error instanceof Error
          ? `${fromCf ? "partial code fixes; " : ""}${error.message}`
          : String(error),
      touchedFiles: fromCf ? Array.from(new Set(touchedFromCodeFix)) : [],
    };
  }
}
