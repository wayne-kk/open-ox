import { readdirSync } from "fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const listDirTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "list_dir",
    description: "List directory contents. Use to explore project structure.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root, default '.'",
        },
      },
      required: [],
    },
  },
};

export const executeListDir: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const path = (args.path as string) || ".";
  const fullPath = resolvePath(path);
  const entries = readdirSync(fullPath, { withFileTypes: true });
  const list = entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .join("\n");
  return { success: true, output: list || "(empty)", meta: { path } };
};

