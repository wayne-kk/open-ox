import { exec, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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

export type ProjectNodeModulesMode =
  | "existing"
  | "bind_mount"
  | "materialized"
  | "symlink_webpack"
  | "pnpm_install";

export interface EnsureProjectNodeModulesResult {
  mode: ProjectNodeModulesMode;
  /**
   * When true, production `next build` must use `--webpack`.
   * Turbopack refuses `node_modules` symlinks that escape `turbopack.root`.
   */
  preferWebpackBuild: boolean;
}

/**
 * argv for `pnpm` to run a production site build with the right bundler.
 * Prefer Turbopack (`next build`); use webpack only when nm provision requires it.
 */
export function pnpmNextBuildArgv(preferWebpackBuild: boolean): string[] {
  return preferWebpackBuild
    ? ["exec", "next", "build", "--webpack"]
    : ["exec", "next", "build"];
}

async function pathHasNext(nodeModulesDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(nodeModulesDir, ...SITE_NEXT_CLI_REL.slice(1)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer a real directory of shared deps (never a symlink path).
 * Docker entrypoint links `sites/template/node_modules` → `/opt/ox-sites-template/node_modules`;
 * `cp -al` / `mount --bind` on that symlink re-creates an escaping link and breaks Turbopack.
 */
async function resolveSharedNodeModules(): Promise<string | null> {
  const candidates = [
    BAKED_TEMPLATE_NM,
    path.join(WORKSPACE_ROOT, "sites", "template", "node_modules"),
  ];
  for (const candidate of candidates) {
    if (!(await pathHasNext(candidate))) continue;
    try {
      const real = await fs.realpath(candidate);
      if (await pathHasNext(real)) return real;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * True when `projectDir/node_modules` is a symlink whose resolved target lies
 * outside `projectDir` (Turbopack sandbox / filesystem root).
 */
export function nodeModulesSymlinkEscapesRoot(
  projectDir: string,
  linkTarget: string
): boolean {
  const root = path.resolve(projectDir);
  const resolved = path.resolve(projectDir, linkTarget);
  if (resolved === root) return false;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return !resolved.startsWith(prefix);
}

async function projectNodeModulesEscapesRoot(projectDir: string): Promise<boolean> {
  const projectNm = path.join(projectDir, "node_modules");
  try {
    const st = await fs.lstat(projectNm);
    if (!st.isSymbolicLink()) return false;
    const target = await fs.readlink(projectNm);
    return nodeModulesSymlinkEscapesRoot(projectDir, target);
  } catch {
    return false;
  }
}

async function nextResolvedIn(projectDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectDir, ...SITE_NEXT_CLI_REL));
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop site `node_modules` safely — umount bind mounts on Linux first so
 * `rm -rf` cannot walk into the shared store.
 */
export async function removeProjectNodeModules(projectDir: string): Promise<void> {
  const projectNm = path.join(projectDir, "node_modules");
  if (process.platform === "linux") {
    try {
      await execFileAsync("umount", [projectNm]);
    } catch {
      /* not a mount point */
    }
  }
  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Linux bind-mount: appears as a real directory inside turbopack.root. */
async function tryBindMount(sharedNm: string, projectNm: string): Promise<boolean> {
  if (process.platform !== "linux") return false;

  try {
    await fs.mkdir(projectNm, { recursive: true });
  } catch {
    /* exists */
  }

  try {
    await execFileAsync("mount", ["--bind", sharedNm, projectNm]);
  } catch (err: unknown) {
    console.warn(
      `[ensureProjectNodeModules] bind-mount failed (${sharedNm} → ${projectNm}):`,
      err instanceof Error ? err.message : String(err)
    );
    try {
      await fs.rmdir(projectNm);
    } catch {
      /* ignore */
    }
    return false;
  }

  if (await pathHasNext(projectNm)) {
    // Refuse symlink results — cp -a of a symlink source can recreate an escaping link.
    try {
      const st = await fs.lstat(projectNm);
      if (st.isSymbolicLink()) {
        await fs.rm(projectNm, { recursive: true, force: true });
        return false;
      }
    } catch {
      /* ignore */
    }
    console.info(`[ensureProjectNodeModules] bind-mounted ${sharedNm} → ${projectNm}`);
    return true;
  }

  try {
    await execFileAsync("umount", [projectNm]);
  } catch {
    /* ignore */
  }
  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return false;
}

async function isRealNodeModulesDir(projectNm: string): Promise<boolean> {
  if (!(await pathHasNext(projectNm))) return false;
  try {
    const st = await fs.lstat(projectNm);
    // Bind mounts and copies are directories; a symlink here still escapes turbopack.root.
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Copy shared node_modules into the site (Turbopack-safe).
 * Linux: hardlink farm (`cp -al`), then full copy if cross-device.
 * macOS/Windows: skip (too heavy) → fall through to symlink + webpack.
 */
async function tryMaterialize(sharedNm: string, projectNm: string): Promise<boolean> {
  if (process.platform !== "linux") return false;

  try {
    await execFileAsync("cp", ["-al", sharedNm, projectNm]);
    if (await isRealNodeModulesDir(projectNm)) {
      console.info(
        `[ensureProjectNodeModules] materialized (hardlink farm) ${sharedNm} → ${projectNm}`
      );
      return true;
    }
  } catch {
    /* cross-device or not a plain directory */
  }
  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  try {
    await fs.cp(sharedNm, projectNm, { recursive: true });
    if (await isRealNodeModulesDir(projectNm)) {
      console.info(`[ensureProjectNodeModules] materialized (copy) ${sharedNm} → ${projectNm}`);
      return true;
    }
  } catch (err: unknown) {
    console.warn(
      `[ensureProjectNodeModules] materialize failed (${sharedNm} → ${projectNm}):`,
      err instanceof Error ? err.message : String(err)
    );
  }
  try {
    await fs.rm(projectNm, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return false;
}

async function trySymlinkShared(sharedNm: string, projectNm: string): Promise<boolean> {
  try {
    await fs.symlink(sharedNm, projectNm, "dir");
    if (await pathHasNext(projectNm)) {
      console.warn(
        `[ensureProjectNodeModules] symlink fallback ${sharedNm} → ${projectNm} ` +
          `(Turbopack unsafe — builds will use --webpack)`
      );
      return true;
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "EEXIST") {
      console.warn(
        `[ensureProjectNodeModules] Could not symlink ${sharedNm} → ${projectNm}:`,
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

async function provisionFromShared(
  projectDir: string,
  sharedNm: string
): Promise<EnsureProjectNodeModulesResult | null> {
  const projectNm = path.join(projectDir, "node_modules");

  if (await tryBindMount(sharedNm, projectNm)) {
    return { mode: "bind_mount", preferWebpackBuild: false };
  }
  if (await tryMaterialize(sharedNm, projectNm)) {
    return { mode: "materialized", preferWebpackBuild: false };
  }
  if (await trySymlinkShared(sharedNm, projectNm)) {
    return { mode: "symlink_webpack", preferWebpackBuild: true };
  }
  return null;
}

/**
 * Ensures `sites/<project>/node_modules/next` exists before `pnpm run build`.
 *
 * Cascade (Turbopack-first):
 * 1. Linux bind-mount of shared template deps (A)
 * 2. Materialize into the site via hardlink farm / copy (C)
 * 3. Symlink + prefer webpack build (D)
 * 4. In-site `pnpm install` if no shared store
 */
export async function ensureProjectNodeModules(
  projectDir: string
): Promise<EnsureProjectNodeModulesResult> {
  if (await nextResolvedIn(projectDir)) {
    if (!(await projectNodeModulesEscapesRoot(projectDir))) {
      return { mode: "existing", preferWebpackBuild: false };
    }

    // Legacy symlink (or host-side link) escapes turbopack.root — try to upgrade.
    const sharedForUpgrade = await resolveSharedNodeModules();
    if (sharedForUpgrade) {
      await removeProjectNodeModules(projectDir);
      const upgraded = await provisionFromShared(projectDir, sharedForUpgrade);
      if (upgraded && (await nextResolvedIn(projectDir))) {
        return upgraded;
      }
      // Provision failed after remove — restore symlink so the site still builds (via webpack).
      if (!(await nextResolvedIn(projectDir))) {
        await trySymlinkShared(sharedForUpgrade, path.join(projectDir, "node_modules"));
      }
    }

    if (await nextResolvedIn(projectDir)) {
      console.warn(
        `[ensureProjectNodeModules] escaping node_modules under ${projectDir}; ` +
          `builds will use --webpack`
      );
      return { mode: "symlink_webpack", preferWebpackBuild: true };
    }
    // Fall through to full provision below.
  }

  await removeProjectNodeModules(projectDir);

  let sharedNm = await resolveSharedNodeModules();
  if (sharedNm) {
    const provisioned = await provisionFromShared(projectDir, sharedNm);
    if (provisioned && (await nextResolvedIn(projectDir))) {
      return provisioned;
    }
  }

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
    if (sharedNm) {
      await removeProjectNodeModules(projectDir);
      const provisioned = await provisionFromShared(projectDir, sharedNm);
      if (provisioned && (await nextResolvedIn(projectDir))) {
        return provisioned;
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

  if (!(await nextResolvedIn(projectDir))) {
    throw new Error(
      `[ensureProjectNodeModules] After pnpm install, still missing Next.js under ${projectDir}. ` +
        "Check sites/template/package.json and that sites/<projectId>/package.json keeps a `next` dependency."
    );
  }

  return { mode: "pnpm_install", preferWebpackBuild: false };
}
