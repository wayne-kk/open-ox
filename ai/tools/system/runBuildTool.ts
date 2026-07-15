import { execFile } from "child_process";
import { promisify } from "util";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { ensureGeneratedSiteTurbopackRoot } from "@/lib/ensureGeneratedSiteTurbopackRoot";
import {
  ensureProjectNodeModules,
  pnpmNextBuildArgv,
} from "@/lib/ensureProjectNodeModules";
import { envForNextWebpackChild } from "@/lib/nextWebpackChildEnv";
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
  const staticBasePath =
    typeof args.openOxStaticBasePath === "string" ? args.openOxStaticBasePath.trim() : "";
  const projectDir = getSiteRoot();
  try {
    const nm = await ensureProjectNodeModules(projectDir);
    await ensureGeneratedSiteTurbopackRoot(projectDir);
    return await withSiteBuildLock(projectDir, async () => {
      // Default: Turbopack. `--webpack` only when node_modules is an escaping symlink
      // (bind-mount / materialize failed) — see ensureProjectNodeModules cascade.
      const pnpmArgs =
        script === "build"
          ? pnpmNextBuildArgv(nm.preferWebpackBuild)
          : (["run", script] as string[]);
      if (nm.preferWebpackBuild && script === "build") {
        console.warn(
          `[run_build] using next build --webpack (nm mode=${nm.mode})`
        );
      }
      const { stdout, stderr } = await execFileAsync("pnpm", pnpmArgs, {
        cwd: projectDir,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        env: envForNextWebpackChild({
          NODE_ENV: "production",
          ...(staticBasePath ? { OPEN_OX_STATIC_BASE_PATH: staticBasePath } : {}),
        }),
      });
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      return { success: true, output };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
};
