import fs from "fs/promises";
import path from "path";

/**
 * Isolate generated-site Turbopack from the open-ox monorepo root.
 *
 * Next 16 infers the workspace root from the parent lockfile. When
 * `outputFileTracingRoot` / `turbopack.root` point there (or disagree and Next
 * prefers tracing root), `next build` compiles the parent `proxy.ts` and fails.
 * Pin both to `__dirname` (the site) so production builds can stay on Turbopack.
 */
export function patchGeneratedSiteNextConfigSource(source: string): string {
  let s = source;

  if (/\bturbopack\s*:\s*\{\s*\}/.test(s)) {
    s = s.replace(
      /\bturbopack\s*:\s*\{\s*\}/,
      "turbopack: {\n    root: __dirname,\n  }"
    );
  } else if (!/\bturbopack\s*:/.test(s)) {
    const injected = s.replace(
      /(const nextConfig:\s*NextConfig\s*=\s*\{\s*\n)/,
      "$1  turbopack: {\n    root: __dirname,\n  },\n"
    );
    if (injected !== s) s = injected;
  } else if (!/\bturbopack\s*:\s*\{[\s\S]*?\broot\s*:/.test(s)) {
    // turbopack present but no root — insert root as first property
    s = s.replace(
      /(\bturbopack\s*:\s*\{\s*)/,
      "$1\n    root: __dirname,"
    );
  }

  s = s.replace(
    /outputFileTracingRoot:\s*path\.join\(__dirname,\s*["']\.\.\/\.\.["']\)/,
    "outputFileTracingRoot: __dirname"
  );

  return s;
}

export async function ensureGeneratedSiteTurbopackRoot(
  projectDir: string
): Promise<boolean> {
  const configPath = path.join(projectDir, "next.config.ts");
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf-8");
  } catch {
    return false;
  }
  const next = patchGeneratedSiteNextConfigSource(raw);
  if (next === raw) return false;
  await fs.writeFile(configPath, next, "utf-8");
  return true;
}
