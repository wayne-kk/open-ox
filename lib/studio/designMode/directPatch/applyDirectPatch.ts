import fs from "fs/promises";
import path from "path";
import { extname } from "path";

import { FileSnapshotTracker } from "@/ai/flows/modify_project/tracking/fileSnapshotTracker";
import { tryFormatSource } from "@/ai/tools/system/prettierFormat";
import { verifyWrittenSourceFile } from "@/ai/flows/generate_project/shared/tsxDiagnostics";
import type { VisualEdit } from "../protocol";
import {
  applyAstVisualEdits,
  splitAstVisualEdits,
  type AstPatchFailure,
} from "../astPatch/applyAstVisualEdits";

export interface DirectPatchResult {
  ok: true;
  diffs: Array<{ file: string; patch: string; stats: { additions: number; deletions: number } }>;
  changedFiles: string[];
}

export interface DirectPatchFailure {
  ok: false;
  error: string;
  code?: string;
}

function astFailureToDirectFailure(failure: AstPatchFailure): DirectPatchFailure {
  return { ok: false, code: failure.code, error: failure.error };
}

async function formatAndVerify(projectDir: string, relPath: string): Promise<DirectPatchFailure | null> {
  const absPath = path.join(projectDir, relPath);
  const content = await fs.readFile(absPath, "utf-8");
  const formatted = await tryFormatSource(content, absPath, extname(absPath));
  if (formatted.content !== content) {
    await fs.writeFile(absPath, formatted.content, "utf-8");
  }
  const verification = await verifyWrittenSourceFile(relPath);
  if (verification.errorCount > 0) {
    return {
      ok: false,
      code: "TYPECHECK_FAILED",
      error: verification.inline || `Typecheck failed for ${relPath}`,
    };
  }
  return null;
}

/**
 * Direct Apply — sole write path.
 * Requires OxSourceMeta on every edit; mutates via server-side JSX AST.
 * Ripgrep / data-ox-id line patch is no longer the primary path.
 */
export async function applyDirectVisualEdits(
  projectDir: string,
  edits: VisualEdit[],
  _options?: { classNameHint?: string }
): Promise<DirectPatchResult | DirectPatchFailure> {
  if (edits.length === 0) {
    return { ok: false, error: "No edits to apply", code: "NO_EDITS" };
  }

  const { astEdits, fallbackEdits } = splitAstVisualEdits(edits);
  if (fallbackEdits.length > 0) {
    return {
      ok: false,
      code: "NO_SOURCE_MAPPING",
      error:
        "One or more edits lack source coordinates (file:line:col). Rebuild local preview with Design Mode instrumentation, or use Modify.",
    };
  }

  const filesToTouch = [...new Set(astEdits.map((e) => e.source.file))];
  const tracker = new FileSnapshotTracker(projectDir);
  for (const file of filesToTouch) {
    await tracker.capture(file);
  }

  const astResult = await applyAstVisualEdits(projectDir, astEdits);
  if (!astResult.ok) return astFailureToDirectFailure(astResult);

  for (const file of astResult.changedFiles) {
    const verifyFailure = await formatAndVerify(projectDir, file);
    if (verifyFailure) return verifyFailure;
  }

  const diffs = await tracker.computeAllDiffs();
  return {
    ok: true,
    diffs,
    changedFiles: diffs.map((d) => d.file),
  };
}
