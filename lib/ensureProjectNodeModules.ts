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
 * Image-baked template deps (Dockerfile `template-deps` stage). Lives outside
 * `/app/sites` so the production bind-mount cannot hide it.
 */
const BAKED_TEMPLATE_NM =
  process.env.OX_BAKED_TEMPLATE_NODE_MODULES?.trim() ||
  "/opt/ox-sites-template/node_modules";

async function pathHasNext(nodeModulesDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(nodeModulesDir, ...SITE_NEXT_CLI_REL.slice(1)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer (1) `sites/template/node_modules`, (2) image-baked `/opt/...`, else null.
 */
async function resolveSharedNodeModules(): Promise<string | null> {
  const candidates = [
    path.join(WORKSPACE_ROOT, "sites", "template", "node_modules"),
    BAKED_TEMPLATE_NM,
  ];
  for (const candidate of candidates) {
    if (await pathHasNext(candidate)) return candidate;
  }
  return null;
}

/**
 * Ensures `sites/<project>/node_modules/next` exists before `pnpm run build`.
 * Prefer symlink to shared template node_modules; otherwise run `pnpm install` in-site.
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

  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  async function trySymlinkShared(sharedNm: string): Promise<boolean> {
    try {
      await fs.symlink(sharedNm, projectNm, "dir");
      if (await nextResolved()) return true;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "EEXIST") {
        console.warn(
          `[ensureProjectNodeModules] Could not symlink ${sharedNm} into ${projectDir}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
      try {
        await fs.rm(projectNm, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  let sharedNm = await resolveSharedNodeModules();
  if (sharedNm && (await trySymlinkShared(sharedNm))) return;

  if (!sharedNm) {
    const templateDir = path.join(WORKSPACE_ROOT, "sites", "template");
    console.warn(
      "[ensureProjectNodeModules] shared template node_modules missing — attempting `pnpm install` in sites/template (one-time)."
    );
    try {
      await runPnpmInstall(templateDir);
    } catch (err: unknown) {
      console.warn(
        "[ensureProjectNodeModules] template pnpm install failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
    sharedNm = await resolveSharedNodeModules();
    if (sharedNm && (await trySymlinkShared(sharedNm))) return;
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
