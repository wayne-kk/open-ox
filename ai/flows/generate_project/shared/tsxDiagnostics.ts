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
