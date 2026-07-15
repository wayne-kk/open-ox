/**
 * Production static export for Vercel Deploy (root `/`, no preview basePath).
 * Reuses prepare/build helpers from staticSitePreview; does not upload to site-previews.
 */

import fs from "fs/promises";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  ensureProjectNodeModules,
  pnpmNextBuildArgv,
} from "@/lib/ensureProjectNodeModules";
import { withSiteBuildLock } from "@/lib/siteBuildLock";
import { getSiteRoot } from "@/lib/projectManager";
import { ensureProjectSourcesOnDisk } from "@/lib/storage";
import {
  computeProjectFingerprint,
  ensureGlobalErrorFromTemplateForProject,
} from "@/lib/previewShared";
import { prepareProjectDirForStaticExport } from "@/lib/staticSitePreview";
import { envForNextWebpackChild } from "@/lib/nextWebpackChildEnv";

const execFileAsync = promisify(execFile);

/** Stamp marker: production root export (not Storage preview basePath). */
export const VERCEL_DEPLOY_BASE_PATH_MARKER = "/";

const STAMP_REL = ".open-ox/vercel-deploy-build-stamp.json";

type DeployBuildStamp = {
  filesFingerprint: string;
  basePath: string;
  builtAt: string;
};

async function readStamp(projectDir: string): Promise<DeployBuildStamp | null> {
  try {
    const raw = await fs.readFile(path.join(projectDir, ...STAMP_REL.split("/")), "utf-8");
    const parsed = JSON.parse(raw) as Partial<DeployBuildStamp>;
    if (
      typeof parsed.filesFingerprint !== "string" ||
      parsed.basePath !== VERCEL_DEPLOY_BASE_PATH_MARKER ||
      !parsed.filesFingerprint.trim()
    ) {
      return null;
    }
    return {
      filesFingerprint: parsed.filesFingerprint.trim(),
      basePath: VERCEL_DEPLOY_BASE_PATH_MARKER,
      builtAt: typeof parsed.builtAt === "string" ? parsed.builtAt : "",
    };
  } catch {
    return null;
  }
}

async function writeStamp(projectDir: string, stamp: DeployBuildStamp): Promise<void> {
  const full = path.join(projectDir, ...STAMP_REL.split("/"));
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, `${JSON.stringify(stamp, null, 2)}\n`, "utf-8");
}

async function canReuse(projectDir: string, filesFingerprint: string): Promise<boolean> {
  const stamp = await readStamp(projectDir);
  if (!stamp || stamp.filesFingerprint !== filesFingerprint) return false;
  try {
    await fs.access(path.join(projectDir, "out", "index.html"));
    return true;
  } catch {
    return false;
  }
}

async function runRootStaticExportBuild(
  projectDir: string,
  preferWebpackBuild = false
): Promise<void> {
  await withSiteBuildLock(projectDir, async () => {
    let stdout = "";
    let stderr = "";
    try {
      const env = envForNextWebpackChild({ NODE_ENV: "production" });
      // Must not inherit preview basePath — production URL is domain root.
      delete env.OPEN_OX_STATIC_BASE_PATH;
      const result = await execFileAsync("pnpm", pnpmNextBuildArgv(preferWebpackBuild), {
        cwd: projectDir,
        env,
        maxBuffer: 12 * 1024 * 1024,
      });
      stdout = result.stdout?.toString() ?? "";
      stderr = result.stderr?.toString() ?? "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const ex = err as { stdout?: string; stderr?: string };
      const tail = [ex.stderr, ex.stdout, msg].filter(Boolean).join("\n").slice(-4000);
      throw new Error(`next build (vercel deploy) failed: ${tail}`);
    }
    if (stderr && /error|failed/i.test(stderr) && !/compiled successfully/i.test(stdout)) {
      console.warn("[vercelDeploy] build stderr:", stderr.slice(-2000));
    }
  });
}

/**
 * Ensure a root-path static export exists under `sites/{id}/out`.
 * Returns absolute path to `out/`.
 */
export async function buildStaticExportForVercelDeploy(
  projectId: string,
  options?: { force?: boolean }
): Promise<{ outDir: string; reused: boolean }> {
  const projectDir = getSiteRoot(projectId);
  await ensureProjectSourcesOnDisk(projectId);
  try {
    await fs.access(path.join(projectDir, "package.json"));
  } catch {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  await ensureGlobalErrorFromTemplateForProject(projectId);
  await prepareProjectDirForStaticExport(projectDir);
  const nm = await ensureProjectNodeModules(projectDir);

  const filesFp = await computeProjectFingerprint(projectId);
  const force = options?.force === true;
  if (!force && (await canReuse(projectDir, filesFp))) {
    return { outDir: path.join(projectDir, "out"), reused: true };
  }

  await runRootStaticExportBuild(projectDir, nm.preferWebpackBuild);
  const outDir = path.join(projectDir, "out");
  try {
    await fs.access(path.join(outDir, "index.html"));
  } catch {
    throw new Error("[vercelDeploy] No out/index.html after production static export");
  }
  await writeStamp(projectDir, {
    filesFingerprint: filesFp,
    basePath: VERCEL_DEPLOY_BASE_PATH_MARKER,
    builtAt: new Date().toISOString(),
  });
  return { outDir, reused: false };
}
