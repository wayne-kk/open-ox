import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const searchCodeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_code",
    description:
      "Search for pattern in codebase. Use to find usages, definitions, or similar code.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Search pattern (regex or plain text)",
        },
        path: {
          type: "string",
          description: "Directory to search, default '.'",
        },
      },
      required: ["pattern"],
    },
  },
};

export const executeSearchCode: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const pattern = args.pattern as string;
  const searchPath = (args.path as string) || ".";
  const fullPath = resolvePath(searchPath);
  try {
    const output = execSync(
      `rg "${pattern.replace(/"/g, '\\"')}" "${fullPath}" --no-heading -n 2>/dev/null || true`,
      {
        encoding: "utf-8",
        maxBuffer: 512 * 1024,
      }
    );
    return {
      success: true,
      output: output?.trim() || "(no matches)",
      meta: { pattern },
    };
  } catch {
    return {
      success: true,
      output: "(search_code: rg not available, placeholder)",
      meta: { pattern },
    };
  }
};

