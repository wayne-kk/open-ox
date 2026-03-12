import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { SITE_ROOT } from "./common";

export const runBuildTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_build",
    description:
      "Run project build. Use to verify generated code compiles.",
    parameters: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "Build script name, default 'build'",
        },
      },
      required: [],
    },
  },
};

export const executeRunBuild: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const script = (args.script as string) || "build";
  try {
    const output = execSync(`pnpm run ${script}`, {
      cwd: SITE_ROOT,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    return { success: true, output: output?.trim() ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
};

