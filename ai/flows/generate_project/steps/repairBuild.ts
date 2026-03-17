import {
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type {
  BuildRepairResult,
  PlannedProjectBlueprint,
  RepairWrite,
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
  const matched = generatedFiles.filter((path) => {
    const fileName = path.split("/").pop()?.toLowerCase() ?? "";
    return lowered.includes(path.toLowerCase()) || (fileName && lowered.includes(fileName));
  });

  if (matched.length > 0) {
    return unique(matched).slice(0, 6);
  }

  const preferred = generatedFiles.filter(
    (path) =>
      path === "app/layout.tsx" ||
      path === "app/page.tsx" ||
      path === "app/globals.css" ||
      path.includes("components/sections/")
  );

  return unique(preferred.length > 0 ? preferred : generatedFiles).slice(-6);
}

function isRepairWriteArray(value: unknown): value is RepairWrite[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as RepairWrite).path === "string" &&
        typeof (item as RepairWrite).content === "string"
    )
  );
}

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

  const relatedFiles = allowedFiles
    .map(
      (path) => `### ${path}
\`\`\`
${readSiteFile(path)}
\`\`\``
    )
    .join("\n\n");

  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("repairBuild"),
    "\n\n",
    loadGuardrail("outputJson"),
  ].join("");

  const userMessage = `## Project
${blueprint.brief.projectTitle}

## Build Failure
\`\`\`
${buildOutput}
\`\`\`

## Allowed Files
${allowedFiles.map((path) => `- ${path}`).join("\n")}

## Related File Contents
${relatedFiles}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.1);
    const parsed = JSON.parse(extractJSON(raw)) as {
      files?: RepairWrite[];
      summary?: string;
    };

    if (!isRepairWriteArray(parsed.files) || parsed.files.length === 0) {
      return {
        success: false,
        output: parsed.summary ?? "repair_build: model returned no file changes",
        touchedFiles: [],
      };
    }

    const safeWrites = parsed.files.filter((file) => allowedFiles.includes(file.path));
    if (safeWrites.length === 0) {
      return {
        success: false,
        output: "repair_build: model attempted to modify files outside the allowed set",
        touchedFiles: [],
      };
    }

    for (const file of safeWrites) {
      await writeSiteFile(file.path, file.content);
      await formatSiteFile(file.path);
    }

    return {
      success: true,
      output: parsed.summary ?? "repair_build: applied targeted file repairs",
      touchedFiles: safeWrites.map((file) => file.path),
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
      touchedFiles: [],
    };
  }
}
