import { execSync } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { SITE_ROOT } from "./common";

export const installPackageTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "install_package",
    description:
      "Install npm package. Use when code references missing dependency.",
    parameters: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description:
            "Package name (e.g. lodash, @radix-ui/react-dialog)",
        },
        dev: {
          type: "boolean",
          description: "Install as devDependency",
        },
      },
      required: ["package"],
    },
  },
};

export const executeInstallPackage: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const pkg = args.package as string;
  const dev = args.dev as boolean;
  const cmd = dev ? `pnpm add -D ${pkg}` : `pnpm add ${pkg}`;
  try {
    const output = execSync(cmd, {
      cwd: SITE_ROOT,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
    return {
      success: true,
      output: output?.trim() ?? `Installed ${pkg}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
};

