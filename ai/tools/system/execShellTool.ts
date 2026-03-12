import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

export const execShellTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "exec_shell",
    description:
      "Execute shell command. Use for: pnpm add, pnpm install, npm run build, etc. Missing dependencies: pnpm add <pkg>.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to run (e.g. pnpm add lodash)",
        },
        cwd: {
          type: "string",
          description: "Working directory, default project root",
        },
      },
      required: ["command"],
    },
  },
};

export const executeExecShell: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const command = args.command as string;
  const cwd = (args.cwd as string) || ".";
  const fullCwd = resolvePath(cwd);
  const output = execSync(command, {
    cwd: fullCwd,
    encoding: "utf-8",
    maxBuffer: 1024 * 1024,
  });
  return { success: true, output: output?.trim() ?? "" };
};

