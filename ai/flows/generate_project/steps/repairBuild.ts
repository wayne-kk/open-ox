import {
  loadStepPrompt,
  loadSystem,
} from "../shared/files";
import { callLLMWithTools } from "../shared/llm";
import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import { getModelForStep } from "@/lib/config/models";
import type {
  BuildRepairResult,
  PlannedProjectBlueprint,
} from "../types";

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

/** Repair tools: read → edit only; outer flow performs build verification. */
const REPAIR_TOOLS = ["read_file", "edit_file", "write_file"];

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

Fix the build error using the smallest possible edits. Start by reading the failing file(s), then use edit_file to patch only the broken lines.`;

  const tools = getSystemToolDefinitions(REPAIR_TOOLS);
  const touchedFiles = new Set<string>();

  try {
    const { toolCalls } = await callLLMWithTools({
      systemPrompt,
      userMessage,
      tools,
      temperature: 0.1,
      maxIterations: 10,
      model: getModelForStep("repair_build"),
    });

    for (const tc of toolCalls) {
      if ((tc.name === "edit_file" || tc.name === "write_file") && tc.args.path) {
        const result = typeof tc.result === "object" ? tc.result : { success: true };
        if (result.success) {
          touchedFiles.add(tc.args.path as string);
        }
      }
    }

    if (touchedFiles.size === 0) {
      return {
        success: false,
        output: "repair_build: agent made no successful edits",
        touchedFiles: [],
      };
    }

    return {
      success: true,
      output: `repair_build: patched ${touchedFiles.size} file(s) via tool calls`,
      touchedFiles: Array.from(touchedFiles),
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
      touchedFiles: Array.from(touchedFiles),
    };
  }
}
