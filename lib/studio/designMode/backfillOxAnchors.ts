import fs from "fs/promises";
import path from "path";

import { isValidOxId } from "./anchor";

const SECTIONS_DIR = "components/sections";

/** Hero.tsx → hero, FeatureGrid.tsx → feature-grid */
export function slugFromSectionBasename(basename: string): string {
  const stem = basename.replace(/\.tsx$/i, "");
  return stem
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const OPENING_TAG_RE = /^(\s*)<([A-Za-z][\w.-]*)(\s[^>/]*)?(\/?>)/;

export function addOxIdToJsxOpeningLine(line: string, oxId: string): string | null {
  if (!isValidOxId(oxId) || line.includes("data-ox-id")) return null;
  const match = line.match(OPENING_TAG_RE);
  if (!match) return null;
  const [, indent, tag, attrs = "", end] = match;
  if (attrs.includes("data-ox-id")) return null;
  return `${indent}<${tag} data-ox-id="${oxId}"${attrs}${end}`;
}

type TagCounters = Record<string, number>;

function nextOxId(slug: string, tag: string, counters: TagCounters): string {
  switch (tag) {
    case "section": {
      counters.section = (counters.section ?? 0) + 1;
      return counters.section === 1 ? `${slug}-root` : `${slug}-section-${counters.section}`;
    }
    case "h1": {
      counters.h1 = (counters.h1 ?? 0) + 1;
      return counters.h1 === 1 ? `${slug}-headline` : `${slug}-h1-${counters.h1}`;
    }
    case "h2": {
      counters.h2 = (counters.h2 ?? 0) + 1;
      return `${slug}-subhead-${counters.h2}`;
    }
    case "h3": {
      counters.h3 = (counters.h3 ?? 0) + 1;
      return `${slug}-heading-${counters.h3}`;
    }
    case "p": {
      counters.p = (counters.p ?? 0) + 1;
      return `${slug}-copy-${counters.p}`;
    }
    case "button": {
      counters.button = (counters.button ?? 0) + 1;
      return `${slug}-cta-${counters.button}`;
    }
    case "a": {
      counters.a = (counters.a ?? 0) + 1;
      return `${slug}-link-${counters.a}`;
    }
    default:
      return `${slug}-${tag}-1`;
  }
}

const BACKFILL_TAGS = new Set(["section", "h1", "h2", "h3", "p", "button", "a"]);

/** Insert missing `data-ox-id` attributes into a section TSX file. */
export function backfillOxAnchorsInSource(content: string, sectionSlug: string): { content: string; added: number } {
  const lines = content.split("\n");
  const counters: TagCounters = {};
  let added = 0;

  const nextLines = lines.map((line) => {
    const match = line.match(OPENING_TAG_RE);
    if (!match) return line;
    const tag = match[2]!.toLowerCase();
    if (!BACKFILL_TAGS.has(tag)) return line;
    const oxId = nextOxId(sectionSlug, tag, counters);
    const patched = addOxIdToJsxOpeningLine(line, oxId);
    if (patched) {
      added += 1;
      return patched;
    }
    return line;
  });

  return { content: nextLines.join("\n"), added };
}

export interface OxAnchorBackfillResult {
  files: string[];
  anchorsAdded: number;
}

export async function backfillOxAnchorsInProject(projectDir: string): Promise<OxAnchorBackfillResult> {
  const sectionsAbs = path.join(projectDir, SECTIONS_DIR);
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(sectionsAbs)).filter((f) => f.endsWith(".tsx"));
  } catch {
    return { files: [], anchorsAdded: 0 };
  }

  const files: string[] = [];
  let anchorsAdded = 0;

  for (const name of entries.sort()) {
    const rel = path.join(SECTIONS_DIR, name);
    const abs = path.join(projectDir, rel);
    const before = await fs.readFile(abs, "utf-8");
    const slug = slugFromSectionBasename(name);
    const { content, added } = backfillOxAnchorsInSource(before, slug);
    if (added === 0) continue;
    await fs.writeFile(abs, content, "utf-8");
    files.push(rel);
    anchorsAdded += added;
  }

  return { files, anchorsAdded };
}
