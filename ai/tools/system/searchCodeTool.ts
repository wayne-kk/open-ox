import { execFileSync } from "child_process";
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
    // Use execFileSync with args array to avoid shell injection (s02 principle)
    const output = execFileSync("rg", [pattern, fullPath, "--no-heading", "-n"], {
      encoding: "utf-8",
      maxBuffer: 512 * 1024,
      timeout: 15_000,
    });
    return {
      success: true,
      output: output?.trim() || "(no matches)",
      meta: { pattern },
    };
  } catch (err) {
    // rg exits with code 1 when no matches — not a real error
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("exited with code 1") || msg.includes("status 1")) {
      return { success: true, output: "(no matches)", meta: { pattern } };
    }
    // rg not installed or other error
    return {
      success: false,
      error: `search_code failed: ${msg.slice(0, 200)}`,
      meta: { pattern },
    };
  }
};

