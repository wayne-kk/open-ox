import fs from "fs/promises";
import path from "path";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";

export const UPLOAD_EXCLUDE = new Set(["node_modules", ".next", ".git"]);

export const SITES_TEMPLATE_DIR = path.join(WORKSPACE_ROOT, "sites", "template");

const GLOBAL_ERROR_REL = "app/global-error.tsx";

/** Minimal `global-error` for static export: no layout/providers; avoids prerender `useContext` null on `/_global-error`. */
const GLOBAL_ERROR_FILE_BODY = [
  '"use client";',
  "",
  "/**",
  " * Must be self-contained: no app/providers or layout imports.",
  " * See https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error",
  " */",
  "export default function GlobalError({",
  "  error,",
  "  reset,",
  "}: {",
  "  error: Error & { digest?: string };",
  "  reset: () => void;",
  "}) {",
  "  return (",
  "    <html lang=\"en\">",
  "      <body>",
  "        <h2>Something went wrong</h2>",
  "        <p>{error.message}</p>",
  "        <button type=\"button\" onClick={() => reset()}>",
  "          Try again",
  "        </button>",
  "      </body>",
  "    </html>",
  "  );",
  "}",
  "",
].join("\n");

/**
 * Overwrites the site’s `app/global-error.tsx` with the repo template (or minimal inline).
 * AI-generated or missing global error pages often break \`output: "export"\` prerendering.
 */
export async function ensureGlobalErrorFromTemplateForProject(projectId: string): Promise<void> {
  const projectDir = getSiteRoot(projectId);
  const src = path.join(SITES_TEMPLATE_DIR, GLOBAL_ERROR_REL);
  const dest = path.join(projectDir, GLOBAL_ERROR_REL);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.copyFile(src, dest);
  } catch {
    await fs.writeFile(dest, GLOBAL_ERROR_FILE_BODY, "utf-8");
  }
}

/** Base config files the generator expects; if missing, copy from `sites/template` (same as E2B upload). */
export const TEMPLATE_BASE_FILE_NAMES = [
  "next.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "eslint.config.mjs",
  "components.json",
];

export const PREVIEW_FALLBACK_FILES: Array<{ path: string; content: string }> = [
  {
    path: "app/components/ConditionalNav.tsx",
    content: `export function ConditionalNav() {
  return null;
}
`,
  },
  {
    path: "app/components/ConditionalFooter.tsx",
    content: `export function ConditionalFooter() {
  return null;
}
`,
  },
  {
    path: "app/components/DynamicFavicon.tsx",
    content: `export function DynamicFavicon() {
  return null;
}
`,
  },
  {
    path: "app/contexts/FaviconContext.tsx",
    content: `import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type FaviconState = "idle" | "thinking" | "notify" | "error";

interface FaviconContextValue {
  state: FaviconState;
  setState: (s: FaviconState) => void;
  startThinking: () => void;
  flashNotify: (durationMs?: number) => void;
  flashError: (durationMs?: number) => void;
}

const FaviconContext = createContext<FaviconContextValue | null>(null);

export function FaviconProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<FaviconState>("idle");

  const setState = useCallback((nextState: FaviconState) => {
    setStateRaw(nextState);
  }, []);

  const startThinking = useCallback(() => {
    setStateRaw("thinking");
  }, []);

  const flashNotify = useCallback(() => {
    setStateRaw("notify");
  }, []);

  const flashError = useCallback(() => {
    setStateRaw("error");
  }, []);

  return (
    <FaviconContext.Provider value={{ state, setState, startThinking, flashNotify, flashError }}>
      {children}
    </FaviconContext.Provider>
  );
}

export function useFavicon() {
  const ctx = useContext(FaviconContext);
  if (!ctx) {
    throw new Error("useFavicon must be used within <FaviconProvider>");
  }
  return ctx;
}
`,
  },
];

export async function collectFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (UPLOAD_EXCLUDE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) continue;
        files.push(path.relative(base, full));
      } catch {
        /* broken symlink */
      }
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

export async function computeProjectFingerprint(projectId: string): Promise<string> {
  const { createHash } = await import("crypto");
  const projectDir = getSiteRoot(projectId);
  const files = await collectFiles(projectDir, projectDir);
  files.sort();
  const hash = createHash("sha256");
  for (const relPath of files) {
    const fullPath = path.join(projectDir, relPath);
    const content = await fs.readFile(fullPath);
    const fileHash = createHash("sha256").update(content).digest("hex");
    hash.update(`${relPath}:${fileHash}\n`);
  }
  return hash.digest("hex").slice(0, 16);
}

export async function writePreviewFallbackFilesIfMissing(projectDir: string): Promise<void> {
  for (const fallback of PREVIEW_FALLBACK_FILES) {
    const dest = path.join(projectDir, fallback.path);
    try {
      await fs.access(dest);
    } catch {
      const destDir = path.dirname(dest);
      await fs.mkdir(destDir, { recursive: true });
      await fs.writeFile(dest, fallback.content, "utf-8");
    }
  }
}

/**
 * If required template files are missing, copy from `sites/template` (mirrors E2B upload list).
 * package.json: prefer project’s own when present; else copy from template.
 */
export async function ensureProjectConfigFromTemplate(projectId: string, relPaths: string[]): Promise<void> {
  const projectDir = getSiteRoot(projectId);
  const fileSet = new Set(relPaths);
  for (const f of TEMPLATE_BASE_FILE_NAMES) {
    if (fileSet.has(f)) continue;
    const src = path.join(SITES_TEMPLATE_DIR, f);
    const dest = path.join(projectDir, f);
    try {
      await fs.copyFile(src, dest);
    } catch {
      /* optional */
    }
  }
  if (!fileSet.has("package.json")) {
    const src = path.join(SITES_TEMPLATE_DIR, "package.json");
    const dest = path.join(projectDir, "package.json");
    try {
      await fs.copyFile(src, dest);
    } catch {
      /* optional */
    }
  }
}

export async function injectStaticExportToProjectDir(projectDir: string): Promise<void> {
  const configPath = path.join(projectDir, "next.config.ts");
  let content: string;
  try {
    content = await fs.readFile(configPath, "utf-8");
  } catch {
    return;
  }
  if (content.includes("output:") || content.includes("output :")) {
    return;
  }
  const patched = content.replace(
    /const nextConfig:\s*NextConfig\s*=\s*\{/,
    `const nextConfig: NextConfig = {\n  output: 'export',\n  images: { unoptimized: true },`
  );
  await fs.writeFile(configPath, patched, "utf-8");
}

export function extractMissingModules(buildOutput: string): string[] {
  const re = /Module not found.*?Can't resolve ['"]([^'"]+)['"]/gi;
  const modules = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(buildOutput)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    if (raw.startsWith(".") || raw.startsWith("/")) continue;
    const normalized = raw.startsWith("@")
      ? raw.split("/").slice(0, 2).join("/")
      : raw.split("/")[0];
    if (normalized) modules.add(normalized);
  }
  return Array.from(modules);
}

const TEMPLATE_PKG_FOR_LOCAL = path.join(SITES_TEMPLATE_DIR, "package.json");

export async function getTemplateDepMap(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(TEMPLATE_PKG_FOR_LOCAL, "utf-8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export async function readProjectPackageJson(
  projectDir: string
): Promise<{ dependencies: Record<string, string>; devDependencies: Record<string, string> } | null> {
  try {
    const raw = await fs.readFile(path.join(projectDir, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      dependencies: { ...(pkg.dependencies ?? {}) },
      devDependencies: { ...(pkg.devDependencies ?? {}) },
    };
  } catch {
    return null;
  }
}

export type PreviewRefreshMode = "hot" | "rebuild";

/**
 * Classify modification diffs to determine if a full rebuild is needed
 * or if a lightweight file-swap + browser refresh is sufficient.
 */
export function classifyModificationScope(
  diffs: Array<{ file: string; patch: string; stats: { additions: number; deletions: number } }>
): PreviewRefreshMode {
  if (diffs.length === 0) return "hot";

  for (const diff of diffs) {
    const { file, patch } = diff;

    if (diff.stats.additions > 0 && diff.stats.deletions === 0 && patch.includes("--- /dev/null")) {
      return "rebuild";
    }

    if (
      file === "next.config.ts" ||
      file === "tsconfig.json" ||
      file === "package.json" ||
      file === "postcss.config.mjs" ||
      file === "tailwind.config.ts"
    ) {
      return "rebuild";
    }

    if (file === "app/layout.tsx") {
      return "rebuild";
    }

    const patchLines = patch.split("\n");
    for (const line of patchLines) {
      if (!line.startsWith("+") || line.startsWith("+++")) continue;
      const content = line.slice(1).trim();
      if (!content) continue;

      if (content.startsWith("import ") || content.startsWith("export ")) {
        if (!content.includes("from ")) continue;
        return "rebuild";
      }

      if (content.match(/^(export\s+)?(function|const|class)\s+\w+/)) {
        return "rebuild";
      }
    }
  }

  return "hot";
}
