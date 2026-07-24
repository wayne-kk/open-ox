import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, extname } from "path";
import ts from "typescript";
import { getSiteRoot } from "@/ai/tools/system/common";
import { tryFormatSource } from "@/ai/tools/system/prettierFormat";
import {
  isVerifiableSourcePath,
  verifyWrittenSourceFile,
} from "@/ai/flows/generate_project/shared/tsxDiagnostics";
import type {
  FileSessionDiagnostic,
  FileSessionMutationResult,
  FileSessionTextEdit,
  FileSessionWorkspace,
} from "./fileSession";
import { createHash } from "node:crypto";
import { join } from "path";

function revision(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function diagnosticsOf(path: string, diagnostics: Array<{ message: string; line?: number; column?: number }>): FileSessionDiagnostic[] {
  return diagnostics.map((diagnostic) => ({ path, ...diagnostic }));
}

function applyEdits(content: string, path: string, edits: FileSessionTextEdit[]): string {
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const offsets = edits.map(({ range, newText }) => ({
    start: source.getPositionOfLineAndCharacter(range.start.line, range.start.character),
    end: source.getPositionOfLineAndCharacter(range.end.line, range.end.character),
    newText,
  })).sort((a, b) => b.start - a.start);
  for (const edit of offsets) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > content.length) {
      throw new Error("INVALID_PATCH_RANGE");
    }
  }
  for (let index = 1; index < offsets.length; index += 1) {
    if (offsets[index - 1].start < offsets[index].end) {
      throw new Error("OVERLAPPING_PATCH_RANGES");
    }
  }
  return offsets.reduce(
    (result, edit) => result.slice(0, edit.start) + edit.newText + result.slice(edit.end),
    content,
  );
}

export class SiteFileSessionWorkspace implements FileSessionWorkspace {
  private fullPath(path: string): string {
    return join(getSiteRoot(), path);
  }

  async read(path: string): Promise<{ content: string; revision: string }> {
    const fullPath = this.fullPath(path);
    if (!existsSync(fullPath)) throw new Error(`File not found: ${path}`);
    const content = readFileSync(fullPath, "utf-8");
    return { content, revision: revision(content) };
  }

  async readIfExists(path: string): Promise<{ content: string; revision: string } | null> {
    const fullPath = this.fullPath(path);
    if (!existsSync(fullPath)) return null;
    const content = readFileSync(fullPath, "utf-8");
    return { content, revision: revision(content) };
  }

  async createOrReplace(
    path: string,
    content: string,
    expectedRevision?: string,
  ): Promise<FileSessionMutationResult> {
    const fullPath = this.fullPath(path);
    mkdirSync(dirname(fullPath), { recursive: true });
    const formatted = await tryFormatSource(content, fullPath, extname(fullPath));
    if (
      expectedRevision &&
      (!existsSync(fullPath) || revision(readFileSync(fullPath, "utf-8")) !== expectedRevision)
    ) {
      throw new Error("STALE_REVISION");
    }
    writeFileSync(fullPath, formatted.content, "utf-8");
    return this.result(path, formatted.content);
  }

  async patch(path: string, baseRevision: string, edits: FileSessionTextEdit[]): Promise<FileSessionMutationResult> {
    const current = await this.read(path);
    if (current.revision !== baseRevision) throw new Error("STALE_REVISION");
    const fullPath = this.fullPath(path);
    const next = applyEdits(current.content, path, edits);
    const formatted = await tryFormatSource(next, fullPath, extname(fullPath));
    // Compare immediately before commit so concurrent page workers cannot overwrite a newer revision.
    const beforeCommit = readFileSync(fullPath, "utf-8");
    if (revision(beforeCommit) !== baseRevision) throw new Error("STALE_REVISION");
    writeFileSync(fullPath, formatted.content, "utf-8");
    return this.result(path, formatted.content);
  }

  async verify(paths: string[]): Promise<Map<string, FileSessionDiagnostic[]>> {
    const verified = new Map<string, FileSessionDiagnostic[]>();
    for (const path of paths) {
      if (!isVerifiableSourcePath(path)) {
        verified.set(path, []);
        continue;
      }
      const result = await verifyWrittenSourceFile(path);
      verified.set(path, diagnosticsOf(path, result.diagnostics));
    }
    return verified;
  }

  private async result(path: string, content: string): Promise<FileSessionMutationResult> {
    const diagnostics = isVerifiableSourcePath(path)
      ? diagnosticsOf(path, (await verifyWrittenSourceFile(path)).diagnostics)
      : [];
    return { content, revision: revision(content), diagnostics };
  }
}
