import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "fs/promises";
import path from "path";

import { findClassNameLineNearAnchor, findTextLineNearAnchor, findUniqueOxAnchorLineIndex, isValidOxId, oxIdSourceLiterals } from "../anchor";
import type { VisualEdit } from "../protocol";

const execFileAsync = promisify(execFile);

function classSearchTokens(className: string): string[] {
  return className
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((token) => token.split(":").pop() ?? token)
    .filter((token) => token.length > 1)
    .slice(0, 3);
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build"]);

/** Walk scopes for *.tsx containing a fixed string — used when `rg` is unavailable (CI). */
async function scanTsxFilesForLiteral(
  projectDir: string,
  pattern: string,
  scopes: string[]
): Promise<string[]> {
  const hits: string[] = [];

  async function walk(absDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(abs);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      try {
        const content = await fs.readFile(abs, "utf-8");
        if (content.includes(pattern)) {
          hits.push(path.relative(projectDir, abs));
        }
      } catch {
        /* skip unreadable */
      }
    }
  }

  for (const scope of scopes) {
    await walk(path.join(projectDir, scope));
  }
  return hits;
}

async function ripgrepFiles(
  projectDir: string,
  pattern: string,
  scopes: string[]
): Promise<string[]> {
  const targets = scopes.map((scope) => path.join(projectDir, scope));
  const args = ["-l", "--glob", "*.tsx", "--fixed-strings", pattern, ...targets];
  try {
    const { stdout } = await execFileAsync("rg", args, { timeout: 8000 });
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((abs) => path.relative(projectDir, abs));
  } catch (err) {
    const e = err as { stdout?: string; code?: string | number };
    // rg exit 1 = no matches
    if (e.code === 1) return [];
    if (e.stdout?.trim()) {
      return e.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((abs) => path.relative(projectDir, abs));
    }
    // Missing `rg` (ENOENT) or other spawn failures — FS scan so CI/tests still resolve.
    return scanTsxFilesForLiteral(projectDir, pattern, scopes);
  }
}

function uniqueTsx(files: string[]): string[] {
  return [...new Set(files.filter((f) => f.endsWith(".tsx")))];
}

async function pickUniqueFile(candidates: string[]): Promise<string | null> {
  const unique = uniqueTsx(candidates);
  if (unique.length === 1) return unique[0]!;
  return null;
}

async function resolveByOxId(
  projectDir: string,
  oxId: string
): Promise<{ file: string } | { error: string }> {
  const searchRoots = ["components/sections", "app", "components"];
  const pattern = oxIdSourceLiterals(oxId)[0]!;
  const byAnchor = uniqueTsx(await ripgrepFiles(projectDir, pattern, searchRoots));
  const unique = await pickUniqueFile(byAnchor);
  if (unique) return { file: unique };
  if (byAnchor.length > 1) {
    return { error: `Ambiguous data-ox-id "${oxId}" in ${byAnchor.length} files` };
  }
  return { error: `No source file contains data-ox-id="${oxId}" — regenerate section or add anchors` };
}

async function resolveByHeuristics(
  projectDir: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ file: string } | { error: string }> {
  const searchRoots = ["components/sections", "app", "components"];

  if (edit.kind === "text" && edit.before.trim()) {
    const byText = uniqueTsx(await ripgrepFiles(projectDir, edit.before.trim(), searchRoots));
    const uniqueText = await pickUniqueFile(byText);
    if (uniqueText) return { file: uniqueText };

    if (byText.length > 1 && classNameHint) {
      for (const token of classSearchTokens(classNameHint)) {
        const resolved = await Promise.all(
          byText.map(async (fileRel) => {
            try {
              const content = await fs.readFile(path.join(projectDir, fileRel), "utf-8");
              return content.includes(token) ? fileRel : null;
            } catch {
              return null;
            }
          })
        );
        const narrowed = resolved.filter((f): f is string => Boolean(f));
        const pick = await pickUniqueFile(narrowed);
        if (pick) return { file: pick };
      }
      return { error: `Ambiguous text match in ${byText.length} files: ${byText.slice(0, 3).join(", ")}` };
    }

    if (byText.length === 0) {
      return { error: `Could not find source file containing "${edit.before.trim()}"` };
    }
  }

  const selectorTail = edit.selectorHint.split(">").pop()?.trim() ?? edit.elementLabel;
  const classToken = selectorTail.includes(".") ? selectorTail.split(".").slice(1)[0] : null;

  if (classToken) {
    const byClass = uniqueTsx(await ripgrepFiles(projectDir, classToken, searchRoots));
    const unique = await pickUniqueFile(byClass);
    if (unique) return { file: unique };
    if (byClass.length > 1) {
      return { error: `Ambiguous class match for "${classToken}" in ${byClass.length} files` };
    }
  }

  if (classNameHint) {
    for (const token of classSearchTokens(classNameHint)) {
      const byToken = uniqueTsx(await ripgrepFiles(projectDir, token, searchRoots));
      const unique = await pickUniqueFile(byToken);
      if (unique) return { file: unique };
    }
  }

  return { error: `Could not resolve source file for ${edit.selectorHint}` };
}

/** Resolve a visual edit to a project-relative TSX file. M2: oxId first, then rg heuristics. */
export async function resolveVisualEditTargetFile(
  projectDir: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ file: string } | { error: string }> {
  if (isValidOxId(edit.oxId)) {
    const anchored = await resolveByOxId(projectDir, edit.oxId);
    if ("file" in anchored) return anchored;
    return anchored;
  }

  return resolveByHeuristics(projectDir, edit, classNameHint);
}

async function findLineByOxId(
  filePath: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ lineIndex: number; line: string } | { error: string }> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const oxId = edit.oxId!;
  const anchorLineIndex = findUniqueOxAnchorLineIndex(content, oxId);
  if (anchorLineIndex == null) {
    return { error: `data-ox-id="${oxId}" is missing or duplicated in ${path.basename(filePath)}` };
  }

  if (edit.kind === "text") {
    const textLine = findTextLineNearAnchor(lines, anchorLineIndex, edit.before);
    if (textLine != null) {
      return { lineIndex: textLine, line: lines[textLine]! };
    }
    return { error: `Text not found near data-ox-id="${oxId}"` };
  }

  const classLine = findClassNameLineNearAnchor(lines, anchorLineIndex);
  if (classLine != null) {
    return { lineIndex: classLine, line: lines[classLine]! };
  }

  if (lines[anchorLineIndex]!.includes("className")) {
    return { lineIndex: anchorLineIndex, line: lines[anchorLineIndex]! };
  }

  return { error: `No className near data-ox-id="${oxId}"` };
}

async function findLineByHeuristics(
  filePath: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ lineIndex: number; line: string } | { error: string }> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  if (edit.kind === "text") {
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(edit.before)) matches.push(i);
    }
    if (matches.length === 1) {
      return { lineIndex: matches[0]!, line: lines[matches[0]!]! };
    }
    if (matches.length === 0) return { error: "Text line not found" };
    return { error: "Text appears on multiple lines" };
  }

  const tokens = classNameHint ? classSearchTokens(classNameHint) : [];
  for (const token of tokens) {
    const hits = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes("className") && line.includes(token));
    if (hits.length === 1) {
      return { lineIndex: hits[0]!.index, line: hits[0]!.line };
    }
  }

  const classLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes("className"));
  if (classLines.length === 1) {
    return { lineIndex: classLines[0]!.index, line: classLines[0]!.line };
  }

  return { error: "Could not find a unique className line to patch" };
}

export async function findLineToPatch(
  filePath: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ lineIndex: number; line: string } | { error: string }> {
  if (isValidOxId(edit.oxId)) {
    return findLineByOxId(filePath, edit, classNameHint);
  }
  return findLineByHeuristics(filePath, edit, classNameHint);
}

/** Patch text within the anchor element window (M2). */
export async function patchTextInAnchorScope(
  filePath: string,
  edit: VisualEdit
): Promise<{ content: string } | { error: string }> {
  if (!isValidOxId(edit.oxId) || edit.kind !== "text") {
    return { error: "Anchor text patch requires oxId" };
  }

  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const anchorLineIndex = findUniqueOxAnchorLineIndex(content, edit.oxId);
  if (anchorLineIndex == null) {
    return { error: `data-ox-id="${edit.oxId}" is missing or duplicated` };
  }

  const textLine = findTextLineNearAnchor(lines, anchorLineIndex, edit.before);
  if (textLine == null) {
    return { error: `Text "${edit.before}" not unique near data-ox-id="${edit.oxId}"` };
  }

  const line = lines[textLine]!;
  const occurrences = line.split(edit.before).length - 1;
  if (occurrences !== 1) {
    return { error: `Text "${edit.before}" is not unique on target line` };
  }

  lines[textLine] = line.replace(edit.before, edit.after);
  return { content: lines.join("\n") };
}
