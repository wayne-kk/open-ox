import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import {
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { callLLMWithTools, extractJSON } from "../shared/llm";
import { WORKSPACE_ROOT } from "../../../tools/system/common";
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

/** Signals that installing an npm package might fix the build (vs TS/syntax/layout-only failures). */
const MISSING_PACKAGE_RE =
  /cannot find module|can't resolve|module not found|err_module_not_found|failed to resolve|package subpath|did you mean to install|is not installed|no package found|npm err!|pnpm.*not found|404.*package/i;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * When `buildOutput` is present (e.g. after a failed build), skip the heavy LLM+tools
 * agent if nothing suggests a missing third-party package. This avoids multi-minute runs
 * that only "skip" already-present deps. When `buildOutput` is absent, we still run
 * the agent to reconcile imports vs package.json after generation.
 */
function shouldRunDependencyAgent(buildOutput: string | undefined): boolean {
  if (buildOutput === undefined || buildOutput.trim().length === 0) {
    return true;
  }
  return MISSING_PACKAGE_RE.test(buildOutput);
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

/** Read all package names already available via sites/template/node_modules symlink. */
function getTemplatePackageNames(): string[] {
  const pkgPath = join(WORKSPACE_ROOT, "sites", "template", "package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
  } catch {
    return [];
  }
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

  if (!shouldRunDependencyAgent(buildOutput)) {
    return {
      summary:
        "skipped dependency agent: build output does not suggest a missing npm package (avoids slow LLM+tools when failure is types/syntax/Next config)",
      installed: [],
      failed: [],
      skipped: [],
    };
  }

  const systemPrompt = [loadSystem("frontend"), loadStepPrompt("dependencyResolver")].join("\n\n");
  const templatePackages = getTemplatePackageNames();
  const sharedPackagesNote = templatePackages.length > 0
    ? `## Already Available Packages\nThe following packages are already installed via the shared node_modules symlink (sites/template/node_modules). DO NOT install these — they are already resolvable:\n${templatePackages.map((p) => `- ${p}`).join("\n")}\n\nOnly install packages that are NOT in this list.\n\n`
    : "";

  const userMessage = `## Goal
Inspect generated files and resolve real third-party package gaps through tools.

${sharedPackagesNote}## Files To Inspect
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
    maxIterations: 5,
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
