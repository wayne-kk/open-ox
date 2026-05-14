import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, extname } from "path";
import ts from "typescript";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";
import { hasFileBeenRead } from "./fileReadTracker";
import { trackFileWrite } from "./fileWriteTracker";
import { tryFormatSource } from "./prettierFormat";
import {
  normalizeWorkspaceText,
  hashRawWorkspaceFile,
} from "../workspace/contentProtocol";
import { compareDiskToBaseHash, recordReadContentHash } from "../workspace/readRevisionStore";
import {
  verifyWrittenSourceFile,
  isVerifiableSourcePath,
} from "../../flows/generate_project/shared/tsxDiagnostics";

export interface WorkspaceTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

function applyEditsToNormalizedSource(
  normalized: string,
  filePathForDisplay: string,
  edits: WorkspaceTextEdit[]
): string | { error: string } {
  const scriptKind = filePathForDisplay.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : filePathForDisplay.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS;

  /** All ranges are interpreted against this original snapshot (matches model intent). */
  const sourceFile = ts.createSourceFile(
    filePathForDisplay,
    normalized,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const offsets: { start: number; end: number; newText: string }[] = [];
  for (const ed of edits) {
    const { start, end } = ed.range;
    try {
      const s = sourceFile.getPositionOfLineAndCharacter(start.line, start.character);
      const e = sourceFile.getPositionOfLineAndCharacter(end.line, end.character);
      if (s < 0 || e < s || e > normalized.length) {
        return {
          error: `Invalid range for edit: start=${start.line},${start.character} end=${end.line},${end.character} (0-based, end exclusive; UTF-16 units). Off-map for this file.`,
        };
      }
      offsets.push({ start: s, end: e, newText: ed.newText });
    } catch (err) {
      return {
        error: `Range out of bounds: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  offsets.sort((a, b) => b.start - a.start);
  let out = normalized;
  for (const { start, end, newText } of offsets) {
    out = out.slice(0, start) + newText + out.slice(end);
  }
  return out;
}

export const applyWorkspaceEditsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "apply_workspace_edits",
    description:
      "Apply one or more text replacements using **0-based line/character positions** (same as LSP / TypeScript). " +
      "`range.end` is **exclusive**. Character counts **UTF-16 code units**. " +
      "From `read_file` line prefixes: line N shown as `N:` → use line index **N - 1**. " +
      "From scoped diagnostics with 1-based line/column: use line0 = line - 1, char0 = column - 1 for start; " +
      "exclusive end: endChar0 = startChar0 + length for same-line spans. " +
      "You **must** call read_file first and pass `base_content_hash` from `meta.contentHash` of that read. " +
      "If the file changed on disk since that read, the tool returns STALE_SNAPSHOT — read again and retry.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from project root" },
        base_content_hash: {
          type: "string",
          description: "Exact contentHash from the latest read_file meta for this path (sha256:...).",
        },
        edits: {
          type: "array",
          description: "Replacements to apply in one transaction (applied from end to start so offsets stay valid).",
          items: {
            type: "object",
            properties: {
              range: {
                type: "object",
                properties: {
                  start: {
                    type: "object",
                    properties: {
                      line: { type: "number", description: "0-based line" },
                      character: {
                        type: "number",
                        description: "0-based UTF-16 offset from line start (exclusive end column for range.end)",
                      },
                    },
                    required: ["line", "character"],
                  },
                  end: {
                    type: "object",
                    properties: {
                      line: { type: "number", description: "0-based line" },
                      character: {
                        type: "number",
                        description: "0-based UTF-16, **exclusive** (first column after replaced span)",
                      },
                    },
                    required: ["line", "character"],
                  },
                },
                required: ["start", "end"],
              },
              newText: { type: "string", description: "Replacement text (may be empty)" },
            },
            required: ["range", "newText"],
          },
        },
      },
      required: ["path", "base_content_hash", "edits"],
    },
  },
};

export const executeApplyWorkspaceEdits: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const filePath = args.path as string;
  const baseHash = args.base_content_hash as string;
  const editsUnknown = args.edits as unknown;

  if (!Array.isArray(editsUnknown) || editsUnknown.length === 0) {
    return { success: false, error: "edits must be a non-empty array" };
  }

  if (!hasFileBeenRead(filePath)) {
    return {
      success: false,
      error: `You must read_file "${filePath}" before apply_workspace_edits.`,
    };
  }

  const fullPath = resolvePath(filePath);
  if (!existsSync(fullPath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const rawDisk = readFileSync(fullPath, "utf-8");
  if (!compareDiskToBaseHash(filePath, rawDisk, baseHash)) {
    const current = hashRawWorkspaceFile(rawDisk);
    return {
      success: false,
      error: `STALE_SNAPSHOT: base_content_hash does not match current file. Expected ${baseHash}, got ${current}. Call read_file again and use the new meta.contentHash.`,
    };
  }

  const normalized = normalizeWorkspaceText(rawDisk);
  const edits = editsUnknown as WorkspaceTextEdit[];
  const applied = applyEditsToNormalizedSource(normalized, filePath, edits);
  if (typeof applied === "object" && "error" in applied) {
    return { success: false, error: applied.error };
  }

  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const ext = extname(fullPath);
  const formatted = isVerifiableSourcePath(filePath)
    ? await tryFormatSource(applied, fullPath, ext)
    : { content: applied, formatted: false };

  writeFileSync(fullPath, formatted.content, "utf-8");
  trackFileWrite(filePath);
  const written = readFileSync(fullPath, "utf-8");
  recordReadContentHash(filePath, written);

  const newHash = hashRawWorkspaceFile(written);
  const note = formatted.formatted ? " (auto-formatted)" : "";
  const verification = isVerifiableSourcePath(filePath)
    ? await verifyWrittenSourceFile(filePath)
    : { inline: "", diagnostics: [], errorCount: 0, warningCount: 0 };
  const baseOutput = `apply_workspace_edits: ${edits.length} edit(s) applied to ${filePath}${note}. New contentHash: ${newHash}`;
  const output = verification.inline ? `${baseOutput}\n\n${verification.inline}` : baseOutput;

  return {
    success: true,
    output,
    meta: {
      path: filePath,
      contentHash: newHash,
      editCount: edits.length,
      autoFormatted: formatted.formatted,
      verifyErrorCount: verification.errorCount,
      verifyWarningCount: verification.warningCount,
    },
    ...(verification.diagnostics.length > 0 ? { diagnostics: verification.diagnostics } : {}),
  };
};
