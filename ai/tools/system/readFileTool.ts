import { readFileSync } from "fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

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
  const fullPath = resolvePath(path);
  const content = readFileSync(fullPath, "utf-8");
  return { success: true, output: content, meta: { path } };
};

