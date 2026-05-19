import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

/** Non-blocking `pnpm install` — unlike `execSync`, other HTTP handlers can run while install proceeds. */
async function runPnpmInstall(cwd: string): Promise<void> {
  await execAsync("pnpm install", {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
}

/** Align with {@link WORKSPACE_ROOT} in `projectManager.ts` — always `process.cwd()`. */
const WORKSPACE_ROOT = process.cwd();

const SITE_NEXT_CLI_REL = ["node_modules", "next", "dist", "bin", "next"] as const;

/**
 * Ensures `sites/<project>/node_modules/next` exists before `pnpm run build`.
 * Prefer symlink to `sites/template/node_modules`; otherwise run `pnpm install` in-site.
 */
export async function ensureProjectNodeModules(projectDir: string): Promise<void> {
  const nextCli = path.join(projectDir, ...SITE_NEXT_CLI_REL);
  async function nextResolved(): Promise<boolean> {
    try {
      await fs.access(nextCli);
      return true;
    } catch {
      return false;
    }
  }
  if (await nextResolved()) return;

  const projectNm = path.join(projectDir, "node_modules");
  const templateNm = path.join(WORKSPACE_ROOT, "sites", "template", "node_modules");
  const templateNextCli = path.join(templateNm, ...SITE_NEXT_CLI_REL);

  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  async function templateHasNext(): Promise<boolean> {
    try {
      await fs.access(templateNextCli);
      return true;
    } catch {
      return false;
    }
  }

  if (await templateHasNext()) {
    try {
      await fs.symlink(templateNm, projectNm, "dir");
      if (await nextResolved()) return;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        console.warn(
          `[ensureProjectNodeModules] Could not symlink template node_modules into ${projectDir}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
      try {
        await fs.rm(projectNm, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  } else {
    console.warn(
      "[ensureProjectNodeModules] sites/template/node_modules/next missing — attempting `pnpm install` in sites/template (one-time)."
    );
    try {
      await runPnpmInstall(path.join(WORKSPACE_ROOT, "sites", "template"));
    } catch (err: unknown) {
      console.warn(
        "[ensureProjectNodeModules] template pnpm install failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
    if (await templateHasNext()) {
      try {
        await fs.symlink(templateNm, projectNm, "dir");
        if (await nextResolved()) return;
      } catch {
        try {
          await fs.rm(projectNm, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  }

  try {
    await runPnpmInstall(projectDir);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[ensureProjectNodeModules] Could not provision node_modules under ${projectDir}: ${msg}. ` +
        "Install template deps (`cd sites/template && pnpm install`) or run `pnpm install` in this site folder."
    );
  }

  if (!(await nextResolved())) {
    throw new Error(
      `[ensureProjectNodeModules] After pnpm install, still missing Next.js under ${projectDir}. ` +
        "Check sites/template/package.json and that sites/<projectId>/package.json keeps a `next` dependency."
    );
  }
}
