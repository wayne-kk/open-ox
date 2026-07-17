import fs from "fs/promises";
import path from "path";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "out",
  "dist",
  ".git",
  "public",
  "open-ox",
]);

/** Matches Design Mode compile-time attrs that must not persist on disk. */
const OX_SOURCE_ATTR_RE =
  /\s*data-ox-(?:source|text-kind|class-kind)(?:=(?:"[^"]*"|'[^']*'))?/g;

async function listTsxFiles(dir: string, relativeRoot: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listTsxFiles(abs, relativeRoot)));
      continue;
    }
    if (!entry.isFile() || !/\.tsx$/i.test(entry.name)) continue;
    out.push(path.relative(relativeRoot, abs));
  }
  return out;
}

export interface StripOxSourceResult {
  filesTouched: string[];
  attrsRemoved: number;
}

/**
 * Remove persisted `data-ox-source` / textKind / classKind from project TSX.
 * Those attrs are compile-time only (webpack loader); disk copies were a Turbopack
 * workaround and must not pollute Modify diffs or source of truth.
 *
 * Uses attribute-level regex so we do not reformat the file via TS printFile.
 */
export function stripOxSourceAttrsFromSource(source: string): { code: string; attrsRemoved: number } {
  let attrsRemoved = 0;
  const code = source.replace(OX_SOURCE_ATTR_RE, () => {
    attrsRemoved += 1;
    return "";
  });
  return { code, attrsRemoved };
}

export async function stripOxSourceFromProject(projectDir: string): Promise<StripOxSourceResult> {
  const roots = ["components", "app"];
  const files: string[] = [];
  for (const root of roots) {
    files.push(
      ...(await listTsxFiles(
        path.join(/* turbopackIgnore: true */ projectDir, root),
        projectDir
      ))
    );
  }

  const filesTouched: string[] = [];
  let attrsRemoved = 0;

  for (const rel of files) {
    const abs = path.join(/* turbopackIgnore: true */ projectDir, rel);
    let source: string;
    try {
      source = await fs.readFile(/* turbopackIgnore: true */ abs, "utf-8");
    } catch {
      continue;
    }
    if (!source.includes("data-ox-source") && !source.includes("data-ox-text-kind")) continue;

    const stripped = stripOxSourceAttrsFromSource(source);
    if (stripped.attrsRemoved === 0 || stripped.code === source) continue;

    await fs.writeFile(abs, stripped.code, "utf-8");
    filesTouched.push(rel.split(path.sep).join("/"));
    attrsRemoved += stripped.attrsRemoved;
  }

  return { filesTouched, attrsRemoved };
}
