import fs from "fs/promises";
import path from "path";
import { structuredPatch } from "diff";

export interface DiffStats {
  additions: number;
  deletions: number;
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function computeDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): { patch: string; stats: DiffStats } {
  const s = structuredPatch(filePath, filePath, oldContent, newContent, "before", "after", {
    context: 3,
  });
  const stats: DiffStats = { additions: 0, deletions: 0 };
  const lines = [`--- ${s.oldHeader}`, `+++ ${s.newHeader}`];
  for (const h of s.hunks) {
    lines.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
    for (const l of h.lines) {
      lines.push(l);
      if (l[0] === "+") stats.additions++;
      else if (l[0] === "-") stats.deletions++;
    }
  }
  return { patch: lines.join("\n"), stats };
}

export class FileSnapshotTracker {
  private snapshots = new Map<string, string>();
  constructor(private projectDir: string) {}
  async capture(relPath: string) {
    if (!this.snapshots.has(relPath))
      this.snapshots.set(relPath, (await tryReadFile(path.join(this.projectDir, relPath))) ?? "");
  }
  async computeAllDiffs() {
    const diffs: Array<{ file: string; patch: string; stats: DiffStats }> = [];
    for (const [rel, old] of this.snapshots) {
      const cur = (await tryReadFile(path.join(this.projectDir, rel))) ?? "";
      if (old !== cur) diffs.push({ file: rel, ...computeDiff(rel, old, cur) });
    }
    return diffs;
  }
  get snapshotMap() {
    return this.snapshots;
  }
  get touchedFiles() {
    return Array.from(this.snapshots.keys());
  }
}
