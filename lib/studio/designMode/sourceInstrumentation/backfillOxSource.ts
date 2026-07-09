import fs from "fs/promises";
import path from "path";

import { instrumentTsxSource } from "./instrumentTsx";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "out",
  "dist",
  ".git",
  "public",
  "open-ox",
]);

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

export interface BackfillOxSourceResult {
  filesTouched: string[];
  nodesAdded: number;
}

/**
 * Persist `data-ox-source` into project TSX on disk so Turbopack (Next 16 default)
 * can serve source maps without the slow webpack loader path.
 *
 * Two passes: insert attrs, then refresh line/col after printFile reformatting.
 */
export async function backfillOxSourceInProject(projectDir: string): Promise<BackfillOxSourceResult> {
  const roots = ["components", "app"];
  const files: string[] = [];
  for (const root of roots) {
    files.push(...(await listTsxFiles(path.join(projectDir, root), projectDir)));
  }

  const filesTouched: string[] = [];
  let nodesAdded = 0;

  for (const rel of files) {
    const abs = path.join(projectDir, rel);
    let source: string;
    try {
      source = await fs.readFile(abs, "utf-8");
    } catch {
      continue;
    }
    if (!/<[A-Za-z]/.test(source)) continue;

    const posixRel = rel.split(path.sep).join("/");
    const first = instrumentTsxSource({ filePath: posixRel, source });
    // Already instrumented (or no JSX nodes) — leave file alone so preview can reuse.
    if (first.instrumentedCount === 0) continue;

    // Refresh coordinates to match printed output (printFile can shift lines).
    const refreshed = instrumentTsxSource(
      { filePath: posixRel, source: first.code },
      { refreshExisting: true }
    );
    await fs.writeFile(abs, refreshed.code, "utf-8");
    filesTouched.push(posixRel);
    nodesAdded += first.instrumentedCount;
  }

  return { filesTouched, nodesAdded };
}
