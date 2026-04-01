import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\//,
  /\bsudo\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
];

const SHELL_TIMEOUT_MS = 120_000;

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

  // Block dangerous commands (s02 principle: tool-layer sandboxing)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { success: false, error: `Blocked dangerous command: ${command}` };
    }
  }

  const cwd = (args.cwd as string) || ".";
  const fullCwd = resolvePath(cwd);
  try {
    const output = execSync(command, {
      cwd: fullCwd,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
      timeout: SHELL_TIMEOUT_MS,
    });
    return { success: true, output: output?.trim() ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // execSync throws on non-zero exit — return as tool error, not exception
    return { success: false, error: msg.slice(0, 2000) };
  }
};

