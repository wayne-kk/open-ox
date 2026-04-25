/**
 * Local preview: `next dev` on 127.0.0.1 (no static export, no `serve out`, no template fallbacks).
 * Shared `node_modules`: symlink from `sites/node_modules` or `sites/template/node_modules` when present;
 * otherwise `npm install` in the project directory only.
 * E2B unchanged: set OPEN_OX_PREVIEW_BACKEND=e2b (see `lib/previewMode.ts`).
 */

import fs from "fs/promises";
import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import path from "path";
import { promisify } from "node:util";
import net from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";
import { restoreProjectFiles } from "./storage";
import { getSavedFingerprint, saveFingerprint } from "./previewFingerprintDb";
import { computeProjectFingerprint, getTemplateDepMap, readProjectPackageJson, SITES_TEMPLATE_DIR } from "./previewShared";

const execFileAsync = promisify(execFile);
const SITES_DIR = path.join(WORKSPACE_ROOT, "sites");
const SHARED_NODE_MODULES_CANDIDATES = [path.join(SITES_DIR, "node_modules"), path.join(SITES_TEMPLATE_DIR, "node_modules")];

type LocalInstance = { port: number; url: string; dev: ChildProcess | null };

const localRegistry = new Map<string, LocalInstance>();

function buildLocalPreviewUrl(port: number): string {
  const host = process.env.OPEN_OX_PREVIEW_PUBLIC_HOST?.replace(/^https?:\/\//, "").split("/")[0];
  if (host) {
    return `http://${host}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      s.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        if (a && typeof a === "object" && a.port) {
          resolve(a.port);
        } else {
          reject(new Error("Could not allocate port"));
        }
      });
    });
  });
}

async function isDirWithFiles(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    if (!st.isDirectory()) return false;
    const ent = await fs.readdir(p);
    return ent.length > 0;
  } catch {
    return false;
  }
}

/**
 * Use shared node_modules (prefer `sites/node_modules`, then `sites/template/node_modules`)
 * via a symlink. If no shared store exists, leave the project to use its own install.
 */
export async function ensureSharedNodeModulesSymlink(projectDir: string): Promise<void> {
  const nm = path.join(projectDir, "node_modules");
  try {
    const st = await fs.lstat(nm);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      if (await isDirWithFiles(nm)) return;
      await fs.rm(nm, { recursive: true, force: true });
    }
  } catch {
    /* missing — create */
  }

  for (const shared of SHARED_NODE_MODULES_CANDIDATES) {
    if (!(await isDirWithFiles(shared))) continue;
    const rel = path.relative(projectDir, shared);
    try {
      await fs.rm(nm, { recursive: true, force: true });
    } catch {
      /* */
    }
    try {
      await fs.symlink(rel, nm, "dir");
    } catch (err) {
      console.warn(`[local preview] Symlink to shared node_modules failed: ${shared}`, err);
    }
    return;
  }
}

async function getMissingDepsOnDisk(projectDir: string): Promise<string[] | null> {
  const nm = path.join(projectDir, "node_modules");
  try {
    await fs.access(nm);
  } catch {
    return null;
  }

  const templateDeps = await getTemplateDepMap();
  const pkg = await readProjectPackageJson(projectDir);
  if (!pkg) return null;
  const projectDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const missing: string[] = [];
  for (const [name, version] of Object.entries(projectDeps)) {
    if (!templateDeps[name]) {
      missing.push(`${name}@${version}`);
    }
  }

  const expectedInTemplate = Object.keys(projectDeps).filter((n) => n in templateDeps);
  for (const name of expectedInTemplate) {
    try {
      await fs.access(path.join(nm, name, "package.json"));
    } catch {
      const v = projectDeps[name];
      if (v && !missing.includes(`${name}@${v}`)) {
        missing.push(`${name}@${v}`);
      }
    }
  }
  return missing;
}

async function runNpmInstall(projectDir: string, extra: string | null): Promise<{ ok: boolean; tail: string }> {
  const args = ["install", "--legacy-peer-deps"];
  if (extra) {
    const parts = extra.trim().split(/\s+/);
    args.push(...parts);
  }
  try {
    const r = await execFileAsync("npm", args, {
      cwd: projectDir,
      maxBuffer: 30 * 1024 * 1024,
    });
    return { ok: true, tail: (r.stdout?.toString() ?? "") + (r.stderr?.toString() ?? "") };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const tail = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "") + (err.message ?? "");
    return { ok: false, tail: tail.slice(-500) };
  }
}

async function isLocalServerUp(url: string): Promise<boolean> {
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {
      /* */
    }
    if (i < attempts - 1) await sleep(500);
  }
  return false;
}

function nextDevOutputMeansReady(t: string): boolean {
  const s = t.toLowerCase();
  if (s.includes("ready in") || /✓\s*ready/i.test(t)) return true;
  if (s.includes("local:") && s.includes("http")) return true;
  if (s.includes("started server")) return true;
  return false;
}

function startNextDevAndWait(
  projectId: string,
  projectDir: string,
  port: number,
  timeoutMs = 120_000
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`next dev did not become ready within ${timeoutMs / 1000}s`));
    }, timeoutMs);
    const shell = process.platform === "win32";
    const child = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development" },
      shell,
    });
    let settled = false;
    const onData = (data: Buffer) => {
      const t = data.toString();
      console.log("[local preview] next dev", t.trim().slice(0, 200));
      if (nextDevOutputMeansReady(t)) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(child);
        }
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`next dev exited before ready (code ${code})`));
      } else {
        localRegistry.delete(projectId);
        console.warn(`[local preview] next dev for ${projectId} exited (code ${code})`);
      }
    });
  });
}

function stopDevInRegistry(projectId: string): void {
  const inst = localRegistry.get(projectId);
  if (inst?.dev && !inst.dev.killed) {
    try {
      inst.dev.kill("SIGTERM");
    } catch {
      /* */
    }
  }
  if (inst) {
    localRegistry.set(projectId, { ...inst, dev: null });
  }
}

async function ensureProjectDirExists(projectId: string): Promise<string> {
  const projectDir = getSiteRoot(projectId);
  try {
    await fs.access(projectDir);
  } catch {
    const restored = await restoreProjectFiles(projectId);
    if (restored.length === 0) {
      throw new Error(`Project directory not found: ${projectDir}`);
    }
  }
  return projectDir;
}

async function runInstallIfNeeded(projectDir: string, label: string): Promise<void> {
  await ensureSharedNodeModulesSymlink(projectDir);
  const miss = await getMissingDepsOnDisk(projectDir);
  if (miss === null) {
    console.log(`[local ${label}] No node_modules in project, running full npm install in project dir...`);
    const r = await runNpmInstall(projectDir, null);
    if (!r.ok) {
      throw new Error(`npm install failed: ${r.tail}`);
    }
  } else if (miss.length > 0) {
    console.log(`[local ${label}] Installing ${miss.length} extra dep(s) in project...`);
    const r = await runNpmInstall(projectDir, miss.join(" "));
    if (!r.ok) {
      throw new Error(`npm install (extras) failed: ${r.tail}`);
    }
  } else {
    console.log(`[local ${label}] Deps satisfied by shared or existing node_modules, skipping install`);
  }
}

export async function startLocalDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  const projectDir = await ensureProjectDirExists(projectId);
  const currentHash = await computeProjectFingerprint(projectId);

  const reg = localRegistry.get(projectId);
  if (reg && (await isLocalServerUp(reg.url))) {
    await saveFingerprint(db, projectId, currentHash);
    return { url: reg.url, port: reg.port };
  }

  stopDevInRegistry(projectId);
  localRegistry.delete(projectId);

  await runInstallIfNeeded(projectDir, "start");
  const port = await getFreePort();
  const url = buildLocalPreviewUrl(port);
  const child = await startNextDevAndWait(projectId, projectDir, port);
  localRegistry.set(projectId, { port, url, dev: child });
  await saveFingerprint(db, projectId, currentHash);
  return { url, port };
}

export async function stopLocalDevServer(projectId: string): Promise<void> {
  const inst = localRegistry.get(projectId);
  if (inst?.dev && !inst.dev.killed) {
    try {
      inst.dev.kill("SIGTERM");
    } catch {
      /* */
    }
  }
  localRegistry.delete(projectId);
}

/**
 * `next dev` already hot-reloads; no rebuild here — return running URL or start.
 */
export async function hotRefreshLocalDevServer(
  db: SupabaseClient,
  projectId: string,
  _changedFiles: string[]
): Promise<{ url: string; port: number; mode: "hot" }> {
  const reg = localRegistry.get(projectId);
  if (reg && (await isLocalServerUp(reg.url))) {
    return { url: reg.url, port: reg.port, mode: "hot" };
  }
  const r = await startLocalDevServer(db, projectId);
  return { ...r, mode: "hot" };
}

export async function rebuildLocalDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  const projectDir = await ensureProjectDirExists(projectId);
  stopDevInRegistry(projectId);
  localRegistry.delete(projectId);
  await fs.rm(path.join(projectDir, ".next"), { recursive: true, force: true });
  await runInstallIfNeeded(projectDir, "rebuild");
  const port = await getFreePort();
  const url = buildLocalPreviewUrl(port);
  const child = await startNextDevAndWait(projectId, projectDir, port);
  localRegistry.set(projectId, { port, url, dev: child });
  try {
    await saveFingerprint(db, projectId, await computeProjectFingerprint(projectId));
  } catch {
    /* */
  }
  return { url, port };
}

export async function ensureLocalDevServerAlive(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "ok" | "down"; url?: string }> {
  const reg = localRegistry.get(projectId);
  if (reg && (await isLocalServerUp(reg.url))) {
    return { status: "ok", url: reg.url };
  }
  if (!reg) {
    return { status: "down" };
  }
  const projectDir = getSiteRoot(projectId);
  stopDevInRegistry(projectId);
  localRegistry.delete(projectId);
  try {
    await runInstallIfNeeded(projectDir, "ensureAlive");
    const port = await getFreePort();
    const url = buildLocalPreviewUrl(port);
    const child = await startNextDevAndWait(projectId, projectDir, port);
    localRegistry.set(projectId, { port, url, dev: child });
    if (await isLocalServerUp(url)) {
      return { status: "ok", url };
    }
  } catch (err) {
    console.error("[local ensureAlive] next dev restart failed:", err);
  }
  return { status: "down" };
}

export async function getLocalDevServerStatus(
  _db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const reg = localRegistry.get(projectId);
  if (!reg) return { status: "stopped" };
  if (await isLocalServerUp(reg.url)) {
    return { status: "running", url: reg.url };
  }
  return { status: "stopped" };
}
