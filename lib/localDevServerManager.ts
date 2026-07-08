/**
 * Local preview: `next dev` binds `127.0.0.1` by default; the URL returned to the browser prefers the
 * loopback host from `NEXT_PUBLIC_SITE_URL` when it is localhost/127.0.0.1 (see `buildLocalPreviewUrl`).
 * Generated sites must include `allowedDevOrigins` in `next.config.ts` (template) so Next.js 16 dev does not
 * block `/_next/` from a cross-loopback Studio iframe ("未发送任何数据" in Chrome).
 *
 * For LAN teammates: set `OPEN_OX_PREVIEW_PUBLIC_HOST`, **or** set `NEXT_PUBLIC_SITE_URL` to a private IP / `.local`
 * host (e.g. `http://192.168.x.x:3000`) — preview URLs and bind address will use that host automatically.
 * Optional `OPEN_OX_PREVIEW_PORT` for a fixed port (firewall). Cloud: `OPEN_OX_PREVIEW_BACKEND=e2b`.
 */
import fs from "fs/promises";
import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import path from "path";
import { promisify } from "node:util";
import net from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";
import { ensureProjectSourcesOnDisk } from "./storage";
import { syncLocalProjectFingerprint } from "./previewFingerprintDb";
import { computeProjectFingerprint, getTemplateDepMap, readProjectPackageJson, SITES_TEMPLATE_DIR, syncProjectRuntimeVersionsFromTemplate } from "./previewShared";
import { ensureDesignModeProjectSetup } from "./studio/designMode/ensureProjectBridge";

/** Sync iframe base Next/React versions + Design Mode bridge/anchors before preview. */
async function preparePreviewProjectForStudio(projectDir: string): Promise<boolean> {
  const pkgSynced = await syncProjectRuntimeVersionsFromTemplate(projectDir);
  if (pkgSynced) {
    console.log("[local preview] Synced next/react versions from sites/template");
    try {
      await fs.rm(path.join(projectDir, "node_modules"), { recursive: true, force: true });
    } catch {
      /* */
    }
  }
  const designModeSetup = await ensureDesignModeProjectSetup(projectDir);
  return pkgSynced || designModeSetup.layoutPatched || designModeSetup.anchorsAdded > 0;
}

const execFileAsync = promisify(execFile);
const SITES_DIR = path.join(WORKSPACE_ROOT, "sites");
const SHARED_NODE_MODULES_CANDIDATES = [path.join(SITES_DIR, "node_modules"), path.join(SITES_TEMPLATE_DIR, "node_modules")];

/** Cross-process reuse: Next may handle API routes on different workers — in-memory `localRegistry` alone misses running `next dev`. */
const LOCAL_PREVIEW_STATE_DIR = path.join(WORKSPACE_ROOT, ".open-ox", "local-preview");

/** Structured phase durations for diagnosing slow POST /preview. */
function timingLog(projectId: string, label: string, start: number, extra?: string): void {
  const ms = Math.round(performance.now() - start);
  const tail = extra ? ` ${extra}` : "";
  console.log(`[local preview][timing] ${label}=${ms}ms projectId=${projectId}${tail}`);
}

type PersistedLocalPreview = { port: number; pid?: number; updatedAt: string };

function persistedPreviewPath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(LOCAL_PREVIEW_STATE_DIR, `${safe}.json`);
}

async function readPersistedLocalPreview(projectId: string): Promise<PersistedLocalPreview | null> {
  try {
    const raw = await fs.readFile(persistedPreviewPath(projectId), "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedLocalPreview>;
    const port = typeof parsed.port === "number" ? parsed.port : Number.NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
    return {
      port,
      pid: typeof parsed.pid === "number" && parsed.pid > 0 ? parsed.pid : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

async function writePersistedLocalPreview(
  projectId: string,
  data: Pick<PersistedLocalPreview, "port" | "pid">
): Promise<void> {
  try {
    await fs.mkdir(LOCAL_PREVIEW_STATE_DIR, { recursive: true });
    const payload: PersistedLocalPreview = {
      port: data.port,
      pid: data.pid,
      updatedAt: new Date().toISOString(),
    };
    const target = persistedPreviewPath(projectId);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2) + "\n", "utf-8");
    await fs.rename(tmp, target);
  } catch (err) {
    console.warn("[local preview] Could not persist preview state:", err);
  }
}

async function clearPersistedLocalPreview(projectId: string): Promise<void> {
  try {
    await fs.unlink(persistedPreviewPath(projectId));
  } catch {
    /* missing */
  }
}

async function killProcessId(pid: number, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid, signal);
  } catch {
    /* ESRCH / EPERM */
  }
}

/** Kill whatever is bound to a preview port (orphan next dev from another worker). */
async function killProcessesOnPort(port: number): Promise<void> {
  if (process.platform === "win32") return;
  try {
    const { stdout } = await execFileAsync("lsof", ["-ti", `:${port}`], { timeout: 5000 });
    const pids = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    for (const pid of pids) {
      await killProcessId(pid, "SIGTERM");
    }
    if (pids.length === 0) return;
    await sleep(700);
    for (const pid of pids) {
      try {
        process.kill(pid, 0);
        await killProcessId(pid, "SIGKILL");
      } catch {
        /* already exited */
      }
    }
  } catch {
    /* lsof: no listeners */
  }
}

/** Best-effort kill of stray `next dev` spawned for this generated site directory. */
async function killOrphanNextDevForProject(projectId: string): Promise<void> {
  if (process.platform === "win32") return;
  const needle = path.join("sites", projectId);
  try {
    const { stdout } = await execFileAsync("pgrep", ["-fl", "next dev"], { timeout: 5000 });
    for (const line of stdout.split("\n")) {
      if (!line.includes(needle)) continue;
      const pid = Number.parseInt(line.trim().split(/\s+/)[0] ?? "", 10);
      if (pid > 0) await killProcessId(pid, "SIGTERM");
    }
    await sleep(500);
  } catch {
    /* pgrep: no matches */
  }
}

async function waitForNextDevLockReleased(projectDir: string, timeoutMs = 20_000): Promise<void> {
  const lockPath = path.join(projectDir, ".next/dev/lock");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let lockPresent = false;
    try {
      await fs.access(lockPath);
      lockPresent = true;
    } catch {
      return;
    }

    if (process.platform !== "win32") {
      try {
        const { stdout } = await execFileAsync("lsof", ["-t", lockPath], { timeout: 3000 });
        const holders = stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isInteger(n) && n > 0);
        if (holders.length > 0) {
          for (const pid of holders) await killProcessId(pid, "SIGTERM");
          await sleep(400);
          continue;
        }
      } catch {
        /* no process holds the lock file */
      }
    }

    if (lockPresent) {
      try {
        await fs.unlink(lockPath);
        return;
      } catch {
        await sleep(300);
      }
    }
  }
  console.warn(`[local preview] Force-clearing stale .next/dev/lock under ${projectDir}`);
  await fs.unlink(lockPath).catch(() => {});
}

/**
 * Stop registry child, persisted pid/port, and orphan next dev processes before a fresh spawn.
 * Prevents Next 16 "Unable to acquire lock" when rebuild races with another worker or zombie dev server.
 */
async function teardownLocalPreviewDevServer(projectId: string, projectDir: string): Promise<void> {
  const reg = localRegistry.get(projectId);
  const hadLiveChild = !!(reg?.dev && !reg.dev.killed);

  stopDevInRegistry(projectId);
  localRegistry.delete(projectId);

  const persisted = await readPersistedLocalPreview(projectId);
  if (persisted?.pid) await killProcessId(persisted.pid, "SIGTERM");
  if (persisted?.port) await killProcessesOnPort(persisted.port);
  if (reg?.port && reg.port !== persisted?.port) await killProcessesOnPort(reg.port);

  await killOrphanNextDevForProject(projectId);
  await clearPersistedLocalPreview(projectId);

  await sleep(hadLiveChild ? 1800 : 900);
  await waitForNextDevLockReleased(projectDir);
}

type LocalInstance = { port: number; url: string; dev: ChildProcess | null };

const localRegistry = new Map<string, LocalInstance>();
/** Serializes concurrent `startLocalDevServer` for the same project (e.g. auto-preview + cover capture). */
const localStartInFlight = new Map<string, Promise<{ url: string; port: number }>>();

/** True for RFC1918-style private IPv4, link-local 169.254.*, or *.local (mDNS). */
function isLikelyLanDevHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  if (h.endsWith(".local")) return true;
  const oct = h.split(".").map((s) => Number(s));
  if (oct.length !== 4 || oct.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = oct;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Host embedded in preview iframe URLs + (when set) binds `0.0.0.0`.
 * Order: `OPEN_OX_PREVIEW_PUBLIC_HOST` → else hostname from `NEXT_PUBLIC_SITE_URL` if it looks like LAN dev.
 */
function previewPublicHost(): string | undefined {
  const raw = process.env.OPEN_OX_PREVIEW_PUBLIC_HOST?.trim();
  if (raw) {
    let s = raw;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    const explicit = s.replace(/^https?:\/\//, "").split("/")[0]?.trim();
    if (explicit) return explicit;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return undefined;
  try {
    const u = new URL(site);
    const host = u.hostname;
    if (host && isLikelyLanDevHostname(host)) return host;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** next dev bind address: loopback by default; all interfaces when a public host is set (LAN / tunnel). */
function previewBindHost(): string {
  return previewPublicHost() ? "0.0.0.0" : "127.0.0.1";
}

/**
 * `OPEN_OX_STATIC_BASE_PATH` is only for Storage static-export builds (`next build`).
 * If it is present in the **host** process env (shell export, shared `.env`, etc.), spawning `next dev` for a
 * generated site makes `sites/template/next.config.ts` apply `basePath` while preview URLs stay at `/` —
 * Chrome reports ERR_TOO_MANY_REDIRECTS.
 */
function envForLocalPreviewDevServer(): NodeJS.ProcessEnv {
  const env = { ...process.env, NODE_ENV: "development" } as Record<string, string | undefined>;
  delete env.OPEN_OX_STATIC_BASE_PATH;
  return env as NodeJS.ProcessEnv;
}

/**
 * Prefer the same loopback spelling as Studio (`NEXT_PUBLIC_SITE_URL`), so the primary document hostname
 * often matches how users open Open-Ox. Child `allowedDevOrigins` still lists both localhost and 127.0.0.1.
 */
function loopbackPreviewUrlHostname(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return "127.0.0.1";
  try {
    const h = new URL(site).hostname;
    if (h === "localhost" || h === "127.0.0.1") return h;
  } catch {
    /* ignore */
  }
  return "127.0.0.1";
}

function buildLocalPreviewUrl(port: number): string {
  const host = previewPublicHost();
  if (host) {
    return `http://${host}:${port}`;
  }
  return `http://${loopbackPreviewUrlHostname()}:${port}`;
}

/** Health checks from this machine: always loopback (works when next dev binds 0.0.0.0). */
function previewHealthCheckUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/**
 * Current iframe / public URL for a running instance — recompute on every call so env changes
 * (e.g. adding OPEN_OX_PREVIEW_PUBLIC_HOST) are not stuck behind a stale `localRegistry` url.
 */
function syncRegistryPublicUrl(projectId: string, reg: LocalInstance): LocalInstance {
  const url = buildLocalPreviewUrl(reg.port);
  if (url !== reg.url) {
    const next = { ...reg, url };
    localRegistry.set(projectId, next);
    return next;
  }
  return reg;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One-time upgrade when old sites lack Next.js dev cross-origin allowances for Studio iframe embedding. */
async function ensurePreviewNextConfigAllowsStudioEmbed(projectDir: string): Promise<void> {
  const dest = path.join(projectDir, "next.config.ts");
  try {
    const content = await fs.readFile(dest, "utf-8");
    if (content.includes("allowedDevOrigins")) return;
  } catch {
    return;
  }
  const templateConfig = path.join(SITES_TEMPLATE_DIR, "next.config.ts");
  try {
    await fs.copyFile(templateConfig, dest);
    console.warn(
      "[local preview] Replaced site's next.config.ts with template copy (missing allowedDevOrigins). " +
        "If you customized next.config.ts, restore from git and merge allowedDevOrigins from sites/template/next.config.ts."
    );
  } catch (err) {
    console.warn("[local preview] Could not sync next.config.ts from template:", err);
  }
}

/**
 * If `next dev` is already up for this project (this worker's registry or persisted port from another worker), adopt and return URL.
 */
async function tryReuseRunningLocalPreview(projectId: string): Promise<{ url: string; port: number } | null> {
  const reg = localRegistry.get(projectId);
  if (reg && (await isLocalServerUp(previewHealthCheckUrl(reg.port)))) {
    const synced = syncRegistryPublicUrl(projectId, reg);
    return { url: synced.url, port: synced.port };
  }

  const persisted = await readPersistedLocalPreview(projectId);
  if (persisted !== null) {
    const baseUrl = previewHealthCheckUrl(persisted.port);
    let up = await isLocalServerUp(baseUrl);
    if (!up) {
      await sleep(600);
      up = await isLocalServerUp(baseUrl);
    }
    if (up) {
      const url = buildLocalPreviewUrl(persisted.port);
      localRegistry.set(projectId, { port: persisted.port, url, dev: null });
      return { url, port: persisted.port };
    }
    await clearPersistedLocalPreview(projectId);
  }

  return null;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, previewBindHost(), () => {
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

function parsedFixedPreviewPort(): number | null {
  const raw = process.env.OPEN_OX_PREVIEW_PORT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) {
    throw new Error(`OPEN_OX_PREVIEW_PORT must be an integer 1–65535, got "${raw}"`);
  }
  return n;
}

/** Random ephemeral port, or `OPEN_OX_PREVIEW_PORT` when set (LAN firewall / sharing). */
async function allocatePreviewPort(): Promise<number> {
  const fixed = parsedFixedPreviewPort();
  if (fixed === null) return getFreePort();
  await new Promise<void>((resolve, reject) => {
    const s = net.createServer();
    s.on("error", (e: NodeJS.ErrnoException) => {
      s.close();
      if (e.code === "EADDRINUSE") {
        reject(
          new Error(
            `OPEN_OX_PREVIEW_PORT=${fixed} is already in use — pick another port or stop the other process`
          )
        );
      } else {
        reject(e);
      }
    });
    s.listen(fixed, previewBindHost(), () => {
      s.close((err) => (err ? reject(err) : resolve()));
    });
  });
  return fixed;
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
  const attempts = 5;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      // Any completed HTTP response counts as "up" — do not require res.ok (3xx/404/500 still mean a server is bound).
      try {
        res.body?.cancel();
      } catch {
        /* */
      }
      return true;
    } catch {
      /* ECONNREFUSED, timeout, reset */
    }
    if (i < attempts - 1) await sleep(400);
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
    const spawnToReadyStart = performance.now();
    const timer = setTimeout(() => {
      reject(new Error(`next dev did not become ready within ${timeoutMs / 1000}s`));
    }, timeoutMs);
    const shell = process.platform === "win32";
    const child = spawn("npx", ["next", "dev", "-H", previewBindHost(), "-p", String(port)], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: envForLocalPreviewDevServer(),
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
          timingLog(projectId, "nextDevSpawnToReady", spawnToReadyStart);
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
        void (async () => {
          const persisted = await readPersistedLocalPreview(projectId);
          if (
            persisted &&
            persisted.port === port &&
            (persisted.pid === undefined || persisted.pid === child.pid)
          ) {
            await clearPersistedLocalPreview(projectId);
          }
          const cur = localRegistry.get(projectId);
          if (cur?.dev === child) {
            localRegistry.delete(projectId);
          }
        })();
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

async function ensureProjectDirExists(
  projectId: string,
  db: SupabaseClient
): Promise<string> {
  const projectDir = getSiteRoot(projectId);
  const pkgPath = path.join(projectDir, "package.json");

  const tRestore = performance.now();
  await fs.mkdir(projectDir, { recursive: true });
  await ensureProjectSourcesOnDisk(projectId, { db });
  timingLog(projectId, "ensureProjectSourcesOnDisk", tRestore);

  const tVerify = performance.now();
  try {
    await fs.access(pkgPath);
  } catch {
    throw new Error(`Project directory not found: ${projectDir}`);
  }
  timingLog(projectId, "verifyPackageJsonAccess", tVerify);
  return projectDir;
}

async function runInstallIfNeeded(projectDir: string, label: string, projectId: string): Promise<void> {
  const tSym = performance.now();
  await ensureSharedNodeModulesSymlink(projectDir);
  timingLog(projectId, `install:${label}.shareNodeModulesSymlink`, tSym);

  const tScan = performance.now();
  const miss = await getMissingDepsOnDisk(projectDir);
  timingLog(projectId, `install:${label}.scanMissingDeps`, tScan);
  if (miss === null) {
    console.log(`[local ${label}] No node_modules in project, running full npm install in project dir...`);
    const tNpm = performance.now();
    const r = await runNpmInstall(projectDir, null);
    timingLog(projectId, `install:${label}.npmFull`, tNpm);
    if (!r.ok) {
      throw new Error(`npm install failed: ${r.tail}`);
    }
  } else if (miss.length > 0) {
    console.log(`[local ${label}] Installing ${miss.length} extra dep(s) in project...`);
    const tNpm = performance.now();
    const r = await runNpmInstall(projectDir, miss.join(" "));
    timingLog(projectId, `install:${label}.npmExtras(count=${miss.length})`, tNpm);
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
  const existing = localStartInFlight.get(projectId);
  if (existing) {
    return existing;
  }

  const work = (async (): Promise<{ url: string; port: number }> => {
    const wallStart = performance.now();
    console.log(`[local preview] startLocalDevServer BEGIN projectId=${projectId}`);

    const tDir = performance.now();
    const projectDir = await ensureProjectDirExists(projectId, db);
    timingLog(projectId, "ensureProjectDirExists(total)", tDir);

    const projectMutated = await preparePreviewProjectForStudio(projectDir);

    const tFp = performance.now();
    const currentHash = await computeProjectFingerprint(projectId);
    timingLog(projectId, "computeProjectFingerprint", tFp);

    const tReuse = performance.now();
    const reusedEarly = projectMutated ? null : await tryReuseRunningLocalPreview(projectId);
    timingLog(projectId, "tryReuseRunningLocalPreview", tReuse);
    if (reusedEarly) {
      await syncLocalProjectFingerprint(db, projectId);
      timingLog(projectId, "TOTAL_startLocalDevServer.exitReuse", wallStart);
      return reusedEarly;
    }

    const reg = localRegistry.get(projectId);

    /** Registry miss or warm-up: avoid killing a live Next dev Turbo is still compiling. */
    const tWarm = performance.now();
    if (!projectMutated && reg && !(await isLocalServerUp(previewHealthCheckUrl(reg.port)))) {
      await sleep(600);
      if (await isLocalServerUp(previewHealthCheckUrl(reg.port))) {
        const synced = syncRegistryPublicUrl(projectId, reg);
        await syncLocalProjectFingerprint(db, projectId);
        timingLog(projectId, "registryWarmRetry600ms+fingerprint", tWarm);
        timingLog(projectId, "TOTAL_startLocalDevServer.exitRegistryWarmReuse", wallStart);
        return { url: synced.url, port: synced.port };
      }
    }
    timingLog(projectId, "registryWarmProbe(noEarlyExit)", tWarm);

    const tTd = performance.now();
    const hadLiveChild = !!(localRegistry.get(projectId)?.dev && !localRegistry.get(projectId)?.dev?.killed);
    await teardownLocalPreviewDevServer(projectId, projectDir);
    timingLog(
      projectId,
      "stopClearPersistStaleLockSleep",
      tTd,
      hadLiveChild ? "sleptMs=1800" : "sleptMs=900"
    );

    await ensurePreviewNextConfigAllowsStudioEmbed(projectDir);

    await runInstallIfNeeded(projectDir, "start", projectId);
    const tPort = performance.now();
    const port = await allocatePreviewPort();
    timingLog(projectId, "allocatePreviewPort", tPort);

    const url = buildLocalPreviewUrl(port);

    const child = await startNextDevAndWait(projectId, projectDir, port);

    localRegistry.set(projectId, { port, url, dev: child });
    await writePersistedLocalPreview(projectId, { port, pid: child.pid ?? undefined });
    const tSav = performance.now();
    await syncLocalProjectFingerprint(db, projectId);
    timingLog(projectId, "saveFingerprint", tSav);

    timingLog(projectId, "TOTAL_startLocalDevServer.exitFreshSpawn", wallStart);
    return { url, port };
  })();

  localStartInFlight.set(projectId, work);
  try {
    return await work;
  } finally {
    if (localStartInFlight.get(projectId) === work) {
      localStartInFlight.delete(projectId);
    }
  }
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
  const persisted = await readPersistedLocalPreview(projectId);
  if (persisted?.pid && (!inst?.dev || inst.dev.killed)) {
    try {
      process.kill(persisted.pid, "SIGTERM");
    } catch {
      /* ESRCH */
    }
  }
  localRegistry.delete(projectId);
  await clearPersistedLocalPreview(projectId);
}

/**
 * `next dev` already hot-reloads; no rebuild here — return running URL or start.
 */
export async function hotRefreshLocalDevServer(
  db: SupabaseClient,
  projectId: string,
  changedFiles: string[]
): Promise<{ url: string; port: number; mode: "hot" }> {
  void changedFiles;
  const reused = await tryReuseRunningLocalPreview(projectId);
  if (reused) {
    return { ...reused, mode: "hot" };
  }
  const r = await startLocalDevServer(db, projectId);
  return { ...r, mode: "hot" };
}

export async function rebuildLocalDevServer(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number }> {
  const wall = performance.now();
  console.log(`[local preview] rebuildLocalDevServer BEGIN projectId=${projectId}`);

  const tEns = performance.now();
  const projectDir = await ensureProjectDirExists(projectId, db);
  timingLog(projectId, "rebuild.ensureProjectDirExists", tEns);

  const reg = localRegistry.get(projectId);
  const hadLiveChild = !!(reg?.dev && !reg.dev.killed);
  const tTd = performance.now();
  await teardownLocalPreviewDevServer(projectId, projectDir);
  timingLog(projectId, "rebuild.teardownKillSleep", tTd, hadLiveChild ? "sleptMs=1800" : "sleptMs=900");

  const tRm = performance.now();
  await fs.rm(path.join(projectDir, ".next"), { recursive: true, force: true });
  timingLog(projectId, "rebuild.rmDotNext", tRm);

  await ensurePreviewNextConfigAllowsStudioEmbed(projectDir);
  await preparePreviewProjectForStudio(projectDir);

  await runInstallIfNeeded(projectDir, "rebuild", projectId);

  const tPort = performance.now();
  const port = await allocatePreviewPort();
  timingLog(projectId, "rebuild.allocatePreviewPort", tPort);

  const url = buildLocalPreviewUrl(port);
  const child = await startNextDevAndWait(projectId, projectDir, port);

  localRegistry.set(projectId, { port, url, dev: child });
  await writePersistedLocalPreview(projectId, { port, pid: child.pid ?? undefined });
  const tFp = performance.now();
  try {
    await syncLocalProjectFingerprint(db, projectId);
  } catch {
    /* */
  }
  timingLog(projectId, "rebuild.saveFingerprint", tFp);

  timingLog(projectId, "TOTAL_rebuildLocalDevServer", wall);
  return { url, port };
}

export async function ensureLocalDevServerAlive(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "ok" | "down"; url?: string }> {
  const reused = await tryReuseRunningLocalPreview(projectId);
  if (reused) {
    return { status: "ok", url: reused.url };
  }

  const reg = localRegistry.get(projectId);
  if (reg && (await isLocalServerUp(previewHealthCheckUrl(reg.port)))) {
    const synced = syncRegistryPublicUrl(projectId, reg);
    return { status: "ok", url: synced.url };
  }
  if (!reg) {
    return { status: "down" };
  }
  const projectDir = getSiteRoot(projectId);
  const hadLiveChild = !!(reg.dev && !reg.dev.killed);
  await teardownLocalPreviewDevServer(projectId, projectDir);
  const wallRestart = performance.now();
  console.log(`[local preview] ensureLocalDevServerAlive RESTART_AFTER_DOWN projectId=${projectId}`);
  try {
    await ensurePreviewNextConfigAllowsStudioEmbed(projectDir);
    await preparePreviewProjectForStudio(projectDir);

    await runInstallIfNeeded(projectDir, "ensureAlive", projectId);
    const tp = performance.now();
    const port = await allocatePreviewPort();
    timingLog(projectId, "ensureAlive.allocatePreviewPort", tp);
    const url = buildLocalPreviewUrl(port);
    const child = await startNextDevAndWait(projectId, projectDir, port);
    localRegistry.set(projectId, { port, url, dev: child });
    await writePersistedLocalPreview(projectId, { port, pid: child.pid ?? undefined });
    if (await isLocalServerUp(previewHealthCheckUrl(port))) {
      timingLog(projectId, "TOTAL_ensureLocalDevServerAlive.restartOk", wallRestart);
      return { status: "ok", url };
    }
    timingLog(projectId, "TOTAL_ensureLocalDevServerAlive.restartSpawnButHealthFail", wallRestart);
  } catch (err) {
    timingLog(projectId, "TOTAL_ensureLocalDevServerAlive.restartCatch", wallRestart);
    console.error("[local ensureAlive] next dev restart failed:", err);
  }
  return { status: "down" };
}

export async function getLocalDevServerStatus(
  _db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const reused = await tryReuseRunningLocalPreview(projectId);
  if (reused) {
    return { status: "running", url: reused.url };
  }
  const reg = localRegistry.get(projectId);
  if (!reg) return { status: "stopped" };
  if (await isLocalServerUp(previewHealthCheckUrl(reg.port))) {
    const synced = syncRegistryPublicUrl(projectId, reg);
    return { status: "running", url: synced.url };
  }
  return { status: "stopped" };
}

/**
 * If local preview is already healthy (this worker or another via persisted port), return URL without starting `next dev`.
 */
export async function getExistingLocalPreviewUrl(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number } | null> {
  const reused = await tryReuseRunningLocalPreview(projectId);
  if (!reused) return null;
  try {
    await syncLocalProjectFingerprint(db, projectId);
  } catch {
    /* */
  }
  return reused;
}
