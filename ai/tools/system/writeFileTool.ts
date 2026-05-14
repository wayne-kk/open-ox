import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { extname } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";
import { tryFormatSource } from "./prettierFormat";
import { trackFileWrite } from "./fileWriteTracker";
import { recordReadContentHash } from "../workspace/readRevisionStore";
import { verifyWrittenSourceFile } from "../../flows/generate_project/shared/tsxDiagnostics";

export const writeFileTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "write_file",
    description:
      "Write content to a file. Creates missing directories. Use for generated code. " +
      "Files with supported extensions (.tsx, .ts, .jsx, .js, .css, .scss, .json, .md, .html) are " +
      "auto-formatted with Prettier on write — you do NOT need to call format_code afterwards. " +
      "After writing TS/TSX/JS/JSX, the tool runs a single-file type-check and surfaces any " +
      "errors directly in the result so you can fix them in this same turn.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Relative path from project root (e.g. app/page.tsx)",
        },
        content: {
          type: "string",
          description: "File content to write",
        },
      },
      required: ["path", "content"],
    },
  },
};

export const executeWriteFile: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const path = args.path as string;
  const content = args.content as string;
  const fullPath = resolvePath(path);
  const dir = fullPath.replace(/\/[^/]+$/, "");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const formatted = await tryFormatSource(content, fullPath, extname(fullPath));
  writeFileSync(fullPath, formatted.content, "utf-8");
  trackFileWrite(path);
  recordReadContentHash(path, readFileSync(fullPath, "utf-8"));

  const note = formatted.formatted ? " (auto-formatted)" : "";
  const verification = await verifyWrittenSourceFile(path);
  const baseOutput = `Written to ${path}${note}`;
  const output = verification.inline
    ? `${baseOutput}\n\n${verification.inline}`
    : baseOutput;

  return {
    success: true,
    output,
    meta: {
      path,
      autoFormatted: formatted.formatted,
      verifyErrorCount: verification.errorCount,
      verifyWarningCount: verification.warningCount,
    },
    ...(verification.diagnostics.length > 0 ? { diagnostics: verification.diagnostics } : {}),
  };
};
