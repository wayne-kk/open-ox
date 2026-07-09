import fs from "fs/promises";
import path from "path";
import ts from "typescript";

import type { DesignModeProperty, VisualEdit } from "../protocol";
import type { OxSourceMeta } from "../sourceInstrumentation/sourceMeta";
import { upsertTailwindUtility } from "../directPatch/sourceMutator";

export type AstPatchErrorCode =
  | "NO_SOURCE_MAPPING"
  | "SOURCE_FILE_MISSING"
  | "SOURCE_NODE_NOT_FOUND"
  | "STATIC_TEXT_NOT_FOUND"
  | "DYNAMIC_TEXT_UNSUPPORTED"
  | "DYNAMIC_CLASS_UNSUPPORTED";

export interface AstPatchResult {
  ok: true;
  changedFiles: string[];
}

export interface AstPatchFailure {
  ok: false;
  code: AstPatchErrorCode;
  error: string;
}

export type AstVisualEdit =
  | { kind: "text"; source: OxSourceMeta; before: string; after: string }
  | { kind: "style"; source: OxSourceMeta; property: DesignModeProperty; before: string; after: string };

function hasSource(edit: VisualEdit): edit is VisualEdit & AstVisualEdit {
  return Boolean((edit as { source?: unknown }).source);
}

export function splitAstVisualEdits(edits: VisualEdit[]): { astEdits: AstVisualEdit[]; fallbackEdits: VisualEdit[] } {
  const astEdits: AstVisualEdit[] = [];
  const fallbackEdits: VisualEdit[] = [];
  for (const edit of edits) {
    if (hasSource(edit)) astEdits.push(edit);
    else fallbackEdits.push(edit);
  }
  return { astEdits, fallbackEdits };
}

function jsxTagName(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  return "unknown";
}

function attrName(attr: ts.JsxAttributeLike): string | null {
  return ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) ? attr.name.text : null;
}

function findElementBySource(sourceFile: ts.SourceFile, source: OxSourceMeta): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let best: ts.JsxElement | ts.JsxSelfClosingElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (jsxTagName(opening.tagName) === source.tag) {
        const pos = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
        const line = pos.line + 1;
        const column = pos.character + 1;
        const distance = Math.abs(line - source.line) * 1000 + Math.abs(column - source.column);
        if (distance < bestDistance) {
          best = node;
          bestDistance = distance;
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return bestDistance <= 5000 ? best : null;
}

function applyReplacements(input: string, replacements: Array<{ start: number; end: number; text: string }>): string {
  return [...replacements]
    .sort((a, b) => b.start - a.start)
    .reduce((next, r) => `${next.slice(0, r.start)}${r.text}${next.slice(r.end)}`, input);
}

function patchTextInSource(sourceFile: ts.SourceFile, node: ts.JsxElement, before: string, after: string): string | AstPatchFailure {
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const child of node.children) {
    if (ts.isJsxText(child) && child.getText().includes(before)) {
      const raw = child.getText();
      replacements.push({ start: child.getStart(sourceFile), end: child.getEnd(), text: raw.replace(before, after) });
      break;
    }
  }

  if (replacements.length === 0) {
    return { ok: false, code: "STATIC_TEXT_NOT_FOUND", error: "Static text was not found in the source-mapped JSX element." };
  }
  return applyReplacements(sourceFile.text, replacements);
}

function patchClassInSource(
  sourceFile: ts.SourceFile,
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  property: DesignModeProperty,
  value: string
): string | AstPatchFailure {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const attr = opening.attributes.properties.find((prop) => attrName(prop) === "className");
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) {
    return { ok: false, code: "DYNAMIC_CLASS_UNSUPPORTED", error: "No static className was found on the source-mapped JSX element." };
  }
  if (!ts.isStringLiteral(attr.initializer)) {
    return { ok: false, code: "DYNAMIC_CLASS_UNSUPPORTED", error: "This className is rendered from an expression and cannot be patched directly yet." };
  }

  const next = upsertTailwindUtility(attr.initializer.text, property, value);
  return applyReplacements(sourceFile.text, [
    { start: attr.initializer.getStart(sourceFile), end: attr.initializer.getEnd(), text: JSON.stringify(next) },
  ]);
}

function safeProjectPath(projectDir: string, relPath: string): string | null {
  const abs = path.resolve(projectDir, relPath);
  const root = path.resolve(projectDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export async function applyAstVisualEdits(projectDir: string, edits: AstVisualEdit[]): Promise<AstPatchResult | AstPatchFailure> {
  if (edits.length === 0) return { ok: true, changedFiles: [] };

  const changedFiles = new Set<string>();

  for (const edit of edits) {
    if (edit.kind === "text" && edit.source.textKind !== "static") {
      return {
        ok: false,
        code: "DYNAMIC_TEXT_UNSUPPORTED",
        error: "This text is rendered from an expression and cannot be patched directly yet.",
      };
    }
    if (edit.kind === "style" && edit.source.classKind !== "static") {
      return {
        ok: false,
        code: "DYNAMIC_CLASS_UNSUPPORTED",
        error: "This className is rendered from an expression and cannot be patched directly yet.",
      };
    }

    const abs = safeProjectPath(projectDir, edit.source.file);
    if (!abs) return { ok: false, code: "SOURCE_FILE_MISSING", error: "Source file path escapes the project root." };

    let sourceText: string;
    try {
      sourceText = await fs.readFile(abs, "utf-8");
    } catch {
      return { ok: false, code: "SOURCE_FILE_MISSING", error: `Source file not found: ${edit.source.file}` };
    }

    const sourceFile = ts.createSourceFile(edit.source.file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = findElementBySource(sourceFile, edit.source);
    if (!node) {
      return { ok: false, code: "SOURCE_NODE_NOT_FOUND", error: "Could not find the source-mapped JSX element." };
    }

    let patched: string | AstPatchFailure;
    if (edit.kind === "text") {
      if (!ts.isJsxElement(node)) {
        return { ok: false, code: "STATIC_TEXT_NOT_FOUND", error: "Static text was not found in the source-mapped JSX element." };
      }
      patched = patchTextInSource(sourceFile, node, edit.before, edit.after);
    } else {
      patched = patchClassInSource(sourceFile, node, edit.property, edit.after);
    }

    if (typeof patched !== "string") return patched;
    await fs.writeFile(abs, patched, "utf-8");
    changedFiles.add(edit.source.file);
  }

  return { ok: true, changedFiles: [...changedFiles] };
}
