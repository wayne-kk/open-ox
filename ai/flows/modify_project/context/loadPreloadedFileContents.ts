import fs from "fs/promises";
import path from "path";

const MAX_FILES = 5;
const MAX_CHARS_CSS = 4000;
const MAX_CHARS_OTHER = 6000;

function normalizeRel(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/$/, "");
}

/**
 * Load file excerpts chosen by the intent router (LLM) — not keyword heuristics.
 */
export async function loadPreloadedFileContents(
  projectDir: string,
  preloadPaths: string[],
  fileTree: string
): Promise<Array<{ path: string; content: string }>> {
  const treeLines = new Set(
    fileTree
      .split("\n")
      .map((l) => normalizeRel(l))
      .filter(Boolean)
  );

  const unique = [...new Set(preloadPaths.map(normalizeRel))].slice(0, MAX_FILES);
  const out: Array<{ path: string; content: string }> = [];

  for (const rel of unique) {
    if (!treeLines.has(rel)) continue;
    try {
      const full = path.join(projectDir, ...rel.split("/"));
      const content = await fs.readFile(full, "utf-8");
      const max = rel.endsWith(".css") ? MAX_CHARS_CSS : MAX_CHARS_OTHER;
      out.push({
        path: rel,
        content: content.length > max ? `${content.slice(0, max)}\n…(truncated)` : content,
      });
    } catch {
      /* skip unreadable */
    }
  }

  return out;
}
