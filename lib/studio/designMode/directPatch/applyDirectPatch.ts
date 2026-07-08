import fs from "fs/promises";
import path from "path";
import { extname } from "path";

import { FileSnapshotTracker } from "@/ai/flows/modify_project/tracking/fileSnapshotTracker";
import { tryFormatSource } from "@/ai/tools/system/prettierFormat";
import { verifyWrittenSourceFile } from "@/ai/flows/generate_project/shared/tsxDiagnostics";
import type { VisualEdit } from "../protocol";
import { findLineToPatch, patchTextInAnchorScope, resolveVisualEditTargetFile } from "./resolveTarget";
import { patchClassNameOnLine, patchTextInFile, upsertTailwindUtility } from "./sourceMutator";
import { isValidOxId } from "../anchor";

export interface DirectPatchResult {
  ok: true;
  diffs: Array<{ file: string; patch: string; stats: { additions: number; deletions: number } }>;
  changedFiles: string[];
}

export interface DirectPatchFailure {
  ok: false;
  error: string;
}

async function writePatchedFile(absPath: string, content: string): Promise<void> {
  const formatted = await tryFormatSource(content, absPath, extname(absPath));
  await fs.writeFile(absPath, formatted.content, "utf-8");
}

async function applyEditToFile(
  projectDir: string,
  relPath: string,
  edit: VisualEdit,
  classNameHint?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const absPath = path.join(projectDir, relPath);
  const content = await fs.readFile(absPath, "utf-8");

  if (edit.kind === "text") {
    if (isValidOxId(edit.oxId)) {
      const scoped = await patchTextInAnchorScope(absPath, edit);
      if ("error" in scoped) return { ok: false, error: scoped.error };
      await writePatchedFile(absPath, scoped.content);
      const verification = await verifyWrittenSourceFile(relPath);
      if (verification.errorCount > 0) {
        return { ok: false, error: verification.inline || `Typecheck failed for ${relPath}` };
      }
      return { ok: true };
    }

    const replacement = patchTextInFile(content, edit.before, edit.after);
    if ("error" in replacement) return { ok: false, error: replacement.error };
    const occurrences = content.split(replacement.old_string).length - 1;
    if (occurrences !== 1) {
      return { ok: false, error: `Text replacement is not unique in ${relPath}` };
    }
    const next = content.replace(replacement.old_string, replacement.new_string);
    await writePatchedFile(absPath, next);
    const verification = await verifyWrittenSourceFile(relPath);
    if (verification.errorCount > 0) {
      return { ok: false, error: verification.inline || `Typecheck failed for ${relPath}` };
    }
    return { ok: true };
  }

  const lineResult = await findLineToPatch(absPath, edit, classNameHint);
  if ("error" in lineResult) return { ok: false, error: lineResult.error };

  const patched = patchClassNameOnLine(lineResult.line, (classes) =>
    upsertTailwindUtility(classes, edit.property, edit.after)
  );
  if (!patched) {
    return { ok: false, error: `No className attribute to patch in ${relPath}` };
  }

  const lines = content.split("\n");
  lines[lineResult.lineIndex] = patched.newLine;
  const next = lines.join("\n");
  await writePatchedFile(absPath, next);
  const verification = await verifyWrittenSourceFile(relPath);
  if (verification.errorCount > 0) {
    return { ok: false, error: verification.inline || `Typecheck failed for ${relPath}` };
  }
  return { ok: true };
}

export async function applyDirectVisualEdits(
  projectDir: string,
  edits: VisualEdit[],
  options?: { classNameHint?: string }
): Promise<DirectPatchResult | DirectPatchFailure> {
  if (edits.length === 0) {
    return { ok: false, error: "No edits to apply" };
  }

  const tracker = new FileSnapshotTracker(projectDir);
  const touched = new Set<string>();

  for (const edit of edits) {
    const target = await resolveVisualEditTargetFile(projectDir, edit, options?.classNameHint);
    if ("error" in target) return { ok: false, error: target.error };

    if (!touched.has(target.file)) {
      await tracker.capture(target.file);
      touched.add(target.file);
    }

    const result = await applyEditToFile(projectDir, target.file, edit, options?.classNameHint);
    if (!result.ok) return { ok: false, error: result.error };
  }

  const diffs = await tracker.computeAllDiffs();
  return {
    ok: true,
    diffs,
    changedFiles: diffs.map((d) => d.file),
  };
}
