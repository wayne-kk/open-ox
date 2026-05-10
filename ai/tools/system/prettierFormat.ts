/**
 * Lightweight Prettier wrapper used by write_file / edit_file to auto-format
 * source files without spawning a subprocess.
 *
 * Uses Prettier's JS API (~10× faster than `execSync("pnpm exec prettier ...")`)
 * and fails open: any error returns the original content so an unrecoverable
 * Prettier failure never blocks code generation.
 */

const PRETTIER_EXTS = new Set([
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".mdx",
  ".html",
  ".yaml",
  ".yml",
]);

type PrettierConfig = Record<string, unknown> | null;

let cachedConfigPromise: Promise<PrettierConfig> | null = null;
let prettierModulePromise: Promise<typeof import("prettier")> | null = null;

async function getPrettier(): Promise<typeof import("prettier")> {
  if (!prettierModulePromise) {
    prettierModulePromise = import("prettier").catch((err) => {
      console.warn("[prettierFormat] prettier import failed:", err);
      throw err;
    });
  }
  return prettierModulePromise;
}

async function getResolvedConfig(filePath: string): Promise<PrettierConfig> {
  if (!cachedConfigPromise) {
    cachedConfigPromise = (async () => {
      try {
        const prettier = await getPrettier();
        const cfg = await prettier.resolveConfig(filePath);
        return (cfg as PrettierConfig) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return cachedConfigPromise;
}

export interface FormatResult {
  content: string;
  formatted: boolean;
}

export async function tryFormatSource(
  source: string,
  fullPath: string,
  ext: string
): Promise<FormatResult> {
  const lower = ext.toLowerCase();
  if (!PRETTIER_EXTS.has(lower)) {
    return { content: source, formatted: false };
  }
  try {
    const prettier = await getPrettier();
    const config = await getResolvedConfig(fullPath);
    const result = await prettier.format(source, {
      ...(config ?? {}),
      filepath: fullPath,
    });
    return { content: result, formatted: result !== source };
  } catch (err) {
    if (process.env.DEBUG_PRETTIER === "1") {
      console.warn(`[prettierFormat] skipped ${fullPath}:`, err);
    }
    return { content: source, formatted: false };
  }
}

/**
 * Format an existing file in place. Used by editFileTool after string
 * replacement, since edit_file does not own a fresh content blob to inject
 * straight into write — it has to format what's now on disk.
 */
export async function tryFormatFileInPlace(fullPath: string): Promise<boolean> {
  try {
    const { readFileSync, writeFileSync } = await import("fs");
    const original = readFileSync(fullPath, "utf-8");
    const ext = fullPath.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
    const result = await tryFormatSource(original, fullPath, ext);
    if (result.formatted) {
      writeFileSync(fullPath, result.content, "utf-8");
    }
    return result.formatted;
  } catch {
    return false;
  }
}
