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
      "Read file content. Use to inspect existing code before modifying.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root",
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
  try {
    const fullPath = resolvePath(path);
    if (!existsSync(fullPath)) {
      return { success: false, error: `File not found: ${path}` };
    }
    const raw = readFileSync(fullPath, "utf-8");
    const truncated = raw.length > MAX_READ_BYTES;
    const content = truncated ? raw.slice(0, MAX_READ_BYTES) + `\n...(truncated, ${raw.length} bytes total)` : raw;
    return { success: true, output: content, meta: { path, truncated } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};

