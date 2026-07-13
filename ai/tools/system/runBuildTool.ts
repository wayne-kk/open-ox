import { execFile } from "child_process";
import { promisify } from "util";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { ensureGeneratedSiteTurbopackRoot } from "@/lib/ensureGeneratedSiteTurbopackRoot";
import { ensureProjectNodeModules } from "@/lib/ensureProjectNodeModules";
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
    await ensureProjectNodeModules(projectDir);
    await ensureGeneratedSiteTurbopackRoot(projectDir);
    return await withSiteBuildLock(projectDir, async () => {
      // Turbopack production build (site-isolated root). `--webpack` is only for
      // Design Mode `next dev` — forcing it on run_build was 3–8× slower.
      const { stdout, stderr } = await execFileAsync("pnpm", ["run", script], {
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

