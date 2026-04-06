import { existsSync, readFileSync } from "fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

/** Max bytes returned to the LLM — prevents context blowout on large files (s06). */
const MAX_READ_BYTES = 100_000;

export const readFileTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "read_file",
    description:
      "Read file content. Supports optional line range to avoid reading entire large files. Use start_line/end_line to focus on specific sections.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root",
        },
        start_line: {
          type: "number",
          description: "Starting line number (1-based, inclusive). Omit to start from beginning.",
        },
        end_line: {
          type: "number",
          description: "Ending line number (1-based, inclusive). Omit to read to end.",
        },
      },
      required: ["path"],
    },
  },
};

export const executeReadFile: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const path = args.path as string;
  const startLine = args.start_line as number | undefined;
  const endLine = args.end_line as number | undefined;
  try {
    const fullPath = resolvePath(path);
    if (!existsSync(fullPath)) {
      return { success: false, error: `File not found: ${path}` };
    }
    const raw = readFileSync(fullPath, "utf-8");
    const totalLines = raw.split("\n").length;

    let content: string;
    let truncated = false;

    if (startLine || endLine) {
      // Line range mode
      const lines = raw.split("\n");
      const start = Math.max(1, startLine ?? 1) - 1; // 0-indexed
      const end = Math.min(lines.length, endLine ?? lines.length);
      content = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
      if (content.length > MAX_READ_BYTES) {
        content = content.slice(0, MAX_READ_BYTES) + `\n...(truncated)`;
        truncated = true;
      }
    } else {
      // Full file mode
      truncated = raw.length > MAX_READ_BYTES;
      content = truncated ? raw.slice(0, MAX_READ_BYTES) + `\n...(truncated, ${raw.length} bytes total)` : raw;
    }

    return { success: true, output: content, meta: { path, truncated, totalLines } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};

