import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import {
  loadSkillPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { callLLMWithTools, extractJSON } from "../shared/llm";
import type {
  AutoInstalledDependency,
  DependencyInstallFailure,
} from "../types";

interface InstallDependenciesParams {
  files: string[];
  buildOutput?: string;
}

interface AgentInstallRecord {
  packageName: string;
  dev?: boolean;
  reason?: string;
}

interface AgentSkipRecord {
  packageName: string;
  reason?: string;
}

interface DependencyAgentOutput {
  summary?: string;
  installed?: AgentInstallRecord[];
  skipped?: AgentSkipRecord[];
}

interface StepInstallDependenciesResult {
  summary: string;
  installed: AutoInstalledDependency[];
  failed: DependencyInstallFailure[];
  skipped: AgentSkipRecord[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildRelatedFilesBlock(files: string[]): string {
  return files
    .map(
      (path) => `### ${path}
\`\`\`
${readSiteFile(path)}
\`\`\``
    )
    .join("\n\n");
}

function getInstallFailureRecords(
  toolCalls: Awaited<ReturnType<typeof callLLMWithTools>>["toolCalls"]
): DependencyInstallFailure[] {
  return toolCalls
    .filter((call) => call.name === "install_package")
    .flatMap((call) => {
      if (typeof call.result === "string") {
        return [];
      }

      if (call.result.success) {
        return [];
      }

      const packageName = typeof call.args.package === "string" ? call.args.package : "unknown";
      const dev = Boolean(call.args.dev);
      return [
        {
          packageName,
          dev,
          trigger: "generated-import",
          files: [],
          error: call.result.error ?? "install_package failed",
        },
      ];
    });
}

function normalizeInstalledRecords(
  records: AgentInstallRecord[] | undefined,
  files: string[]
): AutoInstalledDependency[] {
  return (records ?? [])
    .filter((record) => typeof record.packageName === "string" && record.packageName.trim().length > 0)
    .map((record) => ({
      packageName: record.packageName.trim(),
      dev: Boolean(record.dev),
      trigger: "generated-import" as const,
      files: [...files],
    }));
}

export async function stepInstallDependencies({
  files,
  buildOutput,
}: InstallDependenciesParams): Promise<StepInstallDependenciesResult> {
  const targetFiles = unique(files);
  if (targetFiles.length === 0) {
    return {
      summary: "no generated files to inspect",
      installed: [],
      failed: [],
      skipped: [],
    };
  }

  const systemPrompt = [loadSystem("frontend"), loadSkillPrompt("dependencyResolver")].join("\n\n");
  const userMessage = `## Goal
Inspect generated files and resolve real third-party package gaps through tools.

## Files To Inspect
${targetFiles.map((file) => `- ${file}`).join("\n")}

## Related File Contents
${buildRelatedFilesBlock(targetFiles)}

## Build Output
\`\`\`
${buildOutput ?? "(not available yet)"}
\`\`\`

Remember: this step may inspect and install packages, but must not rewrite source files.`;

  const response = await callLLMWithTools({
    systemPrompt,
    userMessage,
    tools: getSystemToolDefinitions([
      "read_file",
      "list_dir",
      "search_code",
      "install_package",
      "exec_shell",
    ]),
    temperature: 0.1,
    maxIterations: 8,
  });

  let parsed: DependencyAgentOutput = {};
  if (response.content.trim()) {
    try {
      parsed = JSON.parse(extractJSON(response.content)) as DependencyAgentOutput;
    } catch {
      parsed = {};
    }
  }

  const failed = getInstallFailureRecords(response.toolCalls);
  const installed = normalizeInstalledRecords(parsed.installed, targetFiles).filter(
    (record) =>
      !failed.some(
        (failure) =>
          failure.packageName === record.packageName && failure.dev === record.dev
      )
  );

  return {
    summary:
      parsed.summary ??
      (installed.length > 0
        ? `installed ${installed.map((item) => item.packageName).join(", ")}`
        : failed.length > 0
          ? `dependency install failed for ${failed.map((item) => item.packageName).join(", ")}`
          : "dependency agent found no third-party packages to install"),
    installed,
    failed,
    skipped: parsed.skipped ?? [],
  };
}
