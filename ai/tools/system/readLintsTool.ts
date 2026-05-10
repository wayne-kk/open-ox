/**
 * `read_lints` — explicit, agent-driven verification surface.
 *
 * Mirrors Cursor / Claude Code's `ReadLints`: the agent calls this after a
 * group of writes (or whenever it suspects a regression) and gets back the
 * current diagnostics for the requested paths — or, with no paths, every file
 * touched by `write_file` / `edit_file` so far this session.
 *
 * Single-file `tsc` runs are cheap (≈50-200 ms each on a warm LanguageService)
 * thanks to the process-wide `DocumentRegistry` shared inside `tsxDiagnostics`.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolDiagnostic, ToolExecutor, ToolResult } from "../types";
import {
  checkTsxFile,
  isVerifiableSourcePath,
  type TsxIssue,
} from "../../flows/generate_project/shared/tsxDiagnostics";
import { listRecentlyWrittenFiles } from "./fileWriteTracker";

export const readLintsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "read_lints",
    description:
      "Run a single-file TypeScript type-check on one or more files in the project " +
      "and return any errors / warnings as structured diagnostics. " +
      "Call this after a group of write_file / edit_file calls (especially after touching " +
      "multiple files that import from each other) to catch wiring mistakes BEFORE the build step. " +
      "Pass `paths` to scope the check; omit it to check every file you have written or edited so far. " +
      "Only .ts / .tsx / .js / .jsx files are checked — other extensions are skipped silently.",
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of relative paths to check (e.g. ['app/page.tsx', 'components/Hero.tsx']). " +
            "Omit to check every file you have written or edited so far this session.",
        },
      },
      required: [],
    },
  },
};

const MAX_FILES_PER_CALL = 30;
const MAX_INLINE_ISSUES = 24;

function severityOf(category: TsxIssue["category"]): ToolDiagnostic["severity"] {
  return category === "error" ? "error" : "warning";
}

function toToolDiagnostic(issue: TsxIssue): ToolDiagnostic {
  return {
    file: issue.file,
    line: issue.line,
    column: issue.column,
    severity: severityOf(issue.category),
    source: "ts",
    code: issue.code === 0 ? "PARSE" : `TS${issue.code}`,
    message: issue.message,
  };
}

export const executeReadLints: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const rawPaths = Array.isArray(args.paths)
    ? args.paths.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];

  const candidatePaths = rawPaths.length > 0 ? rawPaths : listRecentlyWrittenFiles();
  const verifiable = Array.from(
    new Set(candidatePaths.filter((p) => isVerifiableSourcePath(p)))
  ).sort();

  if (verifiable.length === 0) {
    const explanation =
      rawPaths.length > 0
        ? "None of the requested paths are TypeScript / JavaScript source files."
        : "No write_file / edit_file calls have produced verifiable source files yet.";
    return {
      success: true,
      output: `read_lints: 0 file(s) checked. ${explanation}`,
      meta: { checkedFiles: [], errorCount: 0, warningCount: 0 },
      diagnostics: [],
    };
  }

  const checkedFiles = verifiable.slice(0, MAX_FILES_PER_CALL);
  const truncated = verifiable.length - checkedFiles.length;

  const allIssues: TsxIssue[] = [];
  const skipped: string[] = [];
  for (const rel of checkedFiles) {
    const result = await checkTsxFile(rel);
    if (result.skipped === "missing_file") {
      skipped.push(rel);
      continue;
    }
    if (result.skipped === "disabled") {
      return {
        success: true,
        output:
          "read_lints: skipped — the in-process type-checker is disabled (DISABLE_SECTION_TSC=1). " +
          "Set DISABLE_SECTION_TSC=0 to re-enable.",
        meta: { checkedFiles: [], errorCount: 0, warningCount: 0, skipped: "disabled" },
        diagnostics: [],
      };
    }
    allIssues.push(...result.issues);
  }

  const diagnostics = allIssues.map(toToolDiagnostic);
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

  const lines: string[] = [];
  lines.push(
    `read_lints: checked ${checkedFiles.length} file(s) — ${errorCount} error(s), ${warningCount} warning(s).` +
      (truncated > 0 ? ` (${truncated} more file(s) skipped — pass an explicit \`paths\` array to check them.)` : "")
  );
  if (skipped.length > 0) {
    lines.push(`Missing on disk (skipped): ${skipped.join(", ")}`);
  }
  if (diagnostics.length === 0) {
    lines.push("No diagnostics. ✅");
  } else {
    const shown = diagnostics.slice(0, MAX_INLINE_ISSUES);
    for (const d of shown) {
      lines.push(`  ${d.file}:${d.line}:${d.column}  ${d.severity}  ${d.code}  ${d.message}`);
    }
    const remaining = diagnostics.length - shown.length;
    if (remaining > 0) {
      lines.push(`  … and ${remaining} more diagnostic(s) — narrow with \`paths\` to inspect them.`);
    }
  }

  return {
    success: true,
    output: lines.join("\n"),
    meta: { checkedFiles, errorCount, warningCount },
    diagnostics,
  };
};
