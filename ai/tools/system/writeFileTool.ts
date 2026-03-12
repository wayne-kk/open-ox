import { existsSync, writeFileSync } from "fs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const writeFileTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "write_file",
    description:
      "Write content to a file. Creates missing directories. Use for generated code.",
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
  const { mkdirSync } = await import("fs");
  const dir = fullPath.replace(/\/[^/]+$/, "");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
  return { success: true, output: `Written to ${path}`, meta: { path } };
};

