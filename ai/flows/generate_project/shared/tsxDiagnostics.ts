/**
 * Single-file TypeScript check for generated section components.
 *
 * Runs `tsc` via the in-process TypeScript compiler API against ONE file,
 * using the site project's own `tsconfig.json` so `@/` path aliases resolve.
 *
 * Behaviour notes:
 * - Uses a cached `ts.LanguageService` per site root so repeated checks reuse
 *   parsed lib / node_modules declaration files. First call ~1-2s, subsequent
 *   calls ~100-300ms.
 * - Filters out "Cannot find module 'X'" (TS2307) when X is a bare npm
 *   specifier — `autoInstallDependencies` runs AFTER section generation and
 *   will add those packages to the site's `package.json`. We still surface
 *   "Cannot find module '@/...'" and relative-path imports because those are
 *   real hallucinations that auto-install cannot fix.
 * - Opt-out via `DISABLE_SECTION_TSC=1`.
 */
import ts from "typescript";
import fs from "fs";
import path from "path";
import { getSiteRoot } from "../../../tools/system/common";
import type { StepTrace } from "../types";

export interface TsxIssue {
  file: string;
  line: number;
  column: number;
  code: number;
  category: "error" | "warning" | "suggestion" | "message";
  message: string;
}

export interface CheckTsxFileResult {
  passed: boolean;
  issues: TsxIssue[];
  errorCount: number;
  warningCount: number;
  skipped?: "disabled" | "missing_file" | "exception";
  skippedDetail?: string;
}

const MODULE_NOT_FOUND_CODE = 2307;

interface LanguageServiceCache {
  siteRoot: string;
  compilerOptions: ts.CompilerOptions;
  service: ts.LanguageService;
  files: Map<string, { version: number; content: string }>;
}

let cache: LanguageServiceCache | null = null;

function diagCategory(cat: ts.DiagnosticCategory): TsxIssue["category"] {
  switch (cat) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    case ts.DiagnosticCategory.Suggestion:
      return "suggestion";
    default:
      return "message";
  }
}

function loadCompilerOptions(siteRoot: string): ts.CompilerOptions {
  const tsconfigPath = path.join(siteRoot, "tsconfig.json");
  const fallback: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    allowJs: true,
    skipLibCheck: true,
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    isolatedModules: true,
    baseUrl: siteRoot,
    paths: { "@/*": ["./*"] },
  };

  if (!fs.existsSync(tsconfigPath)) {
    return fallback;
  }

  try {
    const raw = ts.readConfigFile(tsconfigPath, (p) => fs.readFileSync(p, "utf-8"));
    if (raw.error || !raw.config) {
      return fallback;
    }
    const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, siteRoot);
    return {
      ...parsed.options,
      noEmit: true,
      skipLibCheck: true,
      // Incremental cache files are irrelevant for in-process checks and can
      // contend with the site's own `.tsbuildinfo`.
      incremental: false,
      composite: false,
    };
  } catch {
    return fallback;
  }
}

function resetCache() {
  if (cache?.service) {
    try {
      cache.service.dispose();
    } catch {
      // ignore disposal errors
    }
  }
  cache = null;
}

function getService(siteRoot: string): LanguageServiceCache {
  if (cache && cache.siteRoot === siteRoot) {
    return cache;
  }

  resetCache();

  const compilerOptions = loadCompilerOptions(siteRoot);
  const files = new Map<string, { version: number; content: string }>();

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => Array.from(files.keys()),
    getScriptVersion: (fileName) => String(files.get(fileName)?.version ?? 0),
    getScriptSnapshot: (fileName) => {
      const cached = files.get(fileName);
      if (cached) {
        return ts.ScriptSnapshot.fromString(cached.content);
      }
      if (!fs.existsSync(fileName)) {
        return undefined;
      }
      try {
        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf-8"));
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => siteRoot,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  cache = { siteRoot, compilerOptions, service, files };
  return cache;
}

function isIgnorableDiagnostic(diag: ts.Diagnostic): boolean {
  if (diag.code !== MODULE_NOT_FOUND_CODE) return false;
  const text = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
  const match = /Cannot find module '([^']+)'/.exec(text);
  if (!match) return false;
  const spec = match[1];
  // Only ignore bare npm package specifiers — autoInstallDependencies will
  // add these to package.json after section generation.
  // Keep local imports ('@/...', './...', '../...') as real errors.
  if (spec.startsWith("@/")) return false;
  if (spec.startsWith(".") || spec.startsWith("/")) return false;
  return true;
}

function isSectionTscEnabled(): boolean {
  return process.env.DISABLE_SECTION_TSC !== "1";
}

export function resetSectionTscCache(): void {
  resetCache();
}

/**
 * Run a single-file TypeScript check against the generated section file.
 *
 * @param relativePath path relative to the site root (e.g. "components/sections/Hero.tsx")
 */
export async function checkTsxFile(relativePath: string): Promise<CheckTsxFileResult> {
  if (!isSectionTscEnabled()) {
    return {
      passed: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      skipped: "disabled",
      skippedDetail: "DISABLE_SECTION_TSC=1",
    };
  }

  const siteRoot = getSiteRoot();
  const absPath = path.resolve(path.join(siteRoot, relativePath));

  if (!fs.existsSync(absPath)) {
    return {
      passed: false,
      issues: [
        {
          file: relativePath,
          line: 1,
          column: 1,
          code: 0,
          category: "error",
          message: `File not found on disk: ${relativePath}`,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      skipped: "missing_file",
    };
  }

  try {
    const { service, files } = getService(siteRoot);

    const content = fs.readFileSync(absPath, "utf-8");
    const existing = files.get(absPath);
    files.set(absPath, {
      version: (existing?.version ?? 0) + 1,
      content,
    });

    const rawDiagnostics = [
      ...service.getSyntacticDiagnostics(absPath),
      ...service.getSemanticDiagnostics(absPath),
    ];

    const issues: TsxIssue[] = [];
    for (const diag of rawDiagnostics) {
      if (isIgnorableDiagnostic(diag)) continue;

      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      const category = diagCategory(diag.category);

      let line = 1;
      let column = 1;
      let fileLabel = relativePath;
      if (diag.file && typeof diag.start === "number") {
        const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
        line = pos.line + 1;
        column = pos.character + 1;
        fileLabel = path.relative(siteRoot, diag.file.fileName) || relativePath;
      }

      issues.push({
        file: fileLabel,
        line,
        column,
        code: diag.code,
        category,
        message,
      });
    }

    const errorCount = issues.filter((i) => i.category === "error").length;
    const warningCount = issues.filter((i) => i.category === "warning").length;

    return {
      passed: errorCount === 0,
      issues,
      errorCount,
      warningCount,
    };
  } catch (err) {
    // Defensive: never let the type checker itself break section generation.
    const message = err instanceof Error ? err.message : String(err);
    return {
      passed: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      skipped: "exception",
      skippedDetail: message,
    };
  }
}

/**
 * Format the first N issues as a short hint suitable for an LLM retry prompt.
 */
export function formatIssuesForHint(issues: TsxIssue[], limit = 8): string {
  const shown = issues.filter((i) => i.category === "error").slice(0, limit);
  if (shown.length === 0) return "";
  const lines = shown.map((i) => `- ${i.file}:${i.line}:${i.column} TS${i.code} — ${i.message}`);
  const moreCount = issues.filter((i) => i.category === "error").length - shown.length;
  if (moreCount > 0) {
    lines.push(`- … and ${moreCount} more error(s) omitted`);
  }
  return lines.join("\n");
}

/** True when the same opt-out that disables per-section `checkTsxFile` is not set. */
export function isSectionTscCheckEnabled(): boolean {
  return process.env.DISABLE_SECTION_TSC !== "1";
}

/**
 * Whether a path is included in the scoped pre-build pass. Currently **.tsx
 * only** (per product requirement: new generated TSX, not a full `tsc` run).
 */
export function isGeneratedTypeScriptPath(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith(".tsx");
}

/**
 * One line per issue, shaped like `tsc --pretty false` so repair agents can
 * `selectRepairTargets` on file names.
 */
export function formatTsxIssuesAsTscStyleLog(issues: TsxIssue[]): string {
  if (issues.length === 0) {
    return "";
  }
  return issues
    .filter((i) => i.category === "error" || i.category === "warning")
    .map((i) => {
      const sev = i.category === "error" ? "error" : "warning";
      return `${i.file}(${i.line},${i.column}): ${sev} TS${i.code ?? 0}: ${i.message}`;
    })
    .join("\n");
}

export interface CheckGeneratedTypeScriptResult {
  passed: boolean;
  fileCount: number;
  /** Relative paths (site root) that were passed to `checkTsxFile`, sorted. */
  checkedFiles: string[];
  issues: TsxIssue[];
  errorCount: number;
  warningCount: number;
  /** Human-readable log (header + tsc-style lines) for `stepRepairBuild`. */
  tscStyleLog: string;
  skipped?: "disabled" | "no_tsx_files";
}

/**
 * Run the same in-process `checkTsxFile` pass over **only** the given
 * `*.tsx` paths (typically `result.generatedFiles` filtered) — not full
 * `npx tsc` on the whole site. Suitable before `next build` to catch
 * issues on new section/page TSX, then hand off to a patch-style repair.
 */
export async function checkGeneratedTypeScriptFiles(
  relativePaths: string[]
): Promise<CheckGeneratedTypeScriptResult> {
  if (!isSectionTscCheckEnabled()) {
    return {
      passed: true,
      fileCount: 0,
      checkedFiles: [],
      issues: [],
      errorCount: 0,
      warningCount: 0,
      tscStyleLog: "",
      skipped: "disabled",
    };
  }

  const unique = Array.from(new Set(relativePaths.filter((p) => p && isGeneratedTypeScriptPath(p)))).sort();
  if (unique.length === 0) {
    return {
      passed: true,
      fileCount: 0,
      checkedFiles: [],
      issues: [],
      errorCount: 0,
      warningCount: 0,
      tscStyleLog: "",
      skipped: "no_tsx_files",
    };
  }

  const allIssues: TsxIssue[] = [];
  for (const p of unique) {
    const r = await checkTsxFile(p);
    allIssues.push(...r.issues);
  }

  const errorCount = allIssues.filter((i) => i.category === "error").length;
  const warningCount = allIssues.filter((i) => i.category === "warning").length;
  const body = formatTsxIssuesAsTscStyleLog(allIssues);
  const tscStyleLog = [
    `// Scoped typecheck: ${unique.length} generated .tsx file(s), in-process (not full project)`,
    body,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return {
    passed: errorCount === 0,
    fileCount: unique.length,
    checkedFiles: unique,
    issues: allIssues,
    errorCount,
    warningCount,
    tscStyleLog,
  };
}

const TYPECHECK_DETAIL_MAX_FILES = 80;
const TYPECHECK_TRACE_MAX_ISSUES = 120;

/**
 * Multiline `BuildStep.detail` for Studio "Output" and logs: lists checked
 * files and, when non-empty, the same tsc-style diagnostic lines.
 */
export function formatScopedTypecheckDetail(
  scoped: CheckGeneratedTypeScriptResult,
  repairNote?: string
): string {
  if (scoped.skipped === "disabled") {
    return "skipped (DISABLE_SECTION_TSC=1)";
  }
  if (scoped.skipped === "no_tsx_files") {
    return "no .tsx in generated file list";
  }
  const files = scoped.checkedFiles;
  const show = files.slice(0, TYPECHECK_DETAIL_MAX_FILES);
  const rest = files.length - show.length;
  const lines: string[] = [
    "In-process tsc: `checkTsxFile` per .tsx (TypeScript LanguageService), not a full-project `npx tsc`.",
    `Files checked (${files.length}):`,
    ...show.map((f) => `  - ${f}`),
  ];
  if (rest > 0) {
    lines.push(`  … and ${rest} more`);
  }
  if (scoped.errorCount === 0 && scoped.warningCount === 0) {
    lines.push("Result: no errors or warnings.");
  } else if (scoped.tscStyleLog.trim().length > 0) {
    lines.push("", "Diagnostics:", scoped.tscStyleLog);
  }
  if (repairNote) {
    lines.push("", repairNote);
  }
  return lines.join("\n");
}

/**
 * `BuildStep.trace` for the topology Detail drawer: **Output** tab shows JSON
 * with `issues` (capped) and full `tscStyleLog` for copy/paste.
 */
export function buildScopedTypecheckStepTrace(
  scoped: CheckGeneratedTypeScriptResult,
  extra?: { repairTouched?: string[]; repairSuccess?: boolean }
): StepTrace {
  if (scoped.skipped) {
    return { output: { scopedTypecheck: { skipped: scoped.skipped } } };
  }
  const issues = scoped.issues;
  const fixMeta =
    extra && (extra.repairSuccess !== undefined || (extra.repairTouched && extra.repairTouched.length > 0))
      ? {
          ...(extra.repairTouched && extra.repairTouched.length > 0
            ? { repairTouchedFiles: extra.repairTouched }
            : {}),
          ...(extra.repairSuccess !== undefined ? { repairSuccess: extra.repairSuccess } : {}),
        }
      : {};
  return {
    output: {
      scopedTypecheck: {
        engine: "checkTsxFile (typescript LanguageService, one root file at a time)",
        checkedFiles: scoped.checkedFiles,
        fileCount: scoped.fileCount,
        errorCount: scoped.errorCount,
        warningCount: scoped.warningCount,
        issues: issues.slice(0, TYPECHECK_TRACE_MAX_ISSUES),
        issuesTotal: issues.length,
        issuesTruncated: issues.length > TYPECHECK_TRACE_MAX_ISSUES,
        tscStyleLog: scoped.tscStyleLog,
        ...fixMeta,
      },
    },
  };
}
