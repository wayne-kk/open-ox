import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const formatCodeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "format_code",
    description:
      "Format an existing file on disk with Prettier. " +
      "NOTE: write_file and edit_file already auto-format on save — you normally do NOT need to call this. " +
      "Only use it when you suspect a file on disk is unformatted (e.g. produced by another process) " +
      "or when format-on-write was skipped due to an unsupported extension.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to format",
        },
      },
      required: ["path"],
    },
  },
};

export const executeFormatCode: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const path = args.path as string;
  const fullPath = resolvePath(path);
  try {
    execSync(`pnpm exec prettier --write "${fullPath}"`, {
      encoding: "utf-8",
    });
    return { success: true, output: `Formatted ${path}` };
  } catch {
    return {
      success: false,
      error: "format_code: Prettier not available (placeholder)",
    };
  }
};

