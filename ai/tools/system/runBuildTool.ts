import { execFile } from "child_process";
import { promisify } from "util";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { ensureProjectNodeModules } from "@/lib/ensureProjectNodeModules";
import { withSiteBuildLock } from "@/lib/siteBuildLock";
import { getSiteRoot } from "./common";

const execFileAsync = promisify(execFile);

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
  const projectDir = getSiteRoot();
  try {
    await ensureProjectNodeModules(projectDir);
    return await withSiteBuildLock(projectDir, async () => {
      // Prefer explicit `next build --webpack`: Next 16 Turbopack + site webpack()
      // config without turbopack:{} hard-fails (see sites/template/next.config.ts).
      const args =
        script === "build"
          ? (["exec", "next", "build", "--webpack"] as const)
          : (["run", script] as const);
      const { stdout, stderr } = await execFileAsync("pnpm", [...args], {
        cwd: projectDir,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: { ...process.env, NODE_ENV: "production" },
      });
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      return { success: true, output };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
};

