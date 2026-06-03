import { createHash } from "node:crypto";
import fs from "fs/promises";
import path from "path";

const LOCKS_DIR = path.join(process.cwd(), ".open-ox", "site-build-locks");

const POLL_MS = 250;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;

/** Same Node process: serialize before hitting the file lock (avoids stealing our own lock). */
const inProcessChains = new Map<string, Promise<void>>();

function lockFileForProjectDir(projectDir: string): string {
  const id = createHash("sha256").update(path.resolve(projectDir)).digest("hex").slice(0, 32);
  return path.join(LOCKS_DIR, `${id}.lock`);
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Remove Next.js build lock after our process-level mutex is held. */
export async function clearNextBuildDirLock(projectDir: string): Promise<void> {
  const lockPath = path.join(projectDir, ".next", "lock");
  try {
    await fs.unlink(lockPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

async function readLockPid(lockPath: string): Promise<number | "missing" | "unreadable"> {
  try {
    const raw = (await fs.readFile(lockPath, "utf8")).trim();
    const pid = Number(raw.split(/\s/)[0]);
    if (!Number.isInteger(pid) || pid <= 0) return "unreadable";
    return pid;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "missing";
    return "unreadable";
  }
}

/** Only remove lock files left by a dead process — never steal an active or unreadable lock. */
async function tryReleaseStaleOpenOxLock(lockPath: string): Promise<void> {
  const pid = await readLockPid(lockPath);
  if (pid === "missing" || pid === "unreadable") return;
  if (isPidAlive(pid)) return;
  await fs.unlink(lockPath).catch(() => undefined);
}

async function acquireFileBuildLock(
  lockPath: string,
  projectDir: string,
  timeoutMs: number
): Promise<fs.FileHandle> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await tryReleaseStaleOpenOxLock(lockPath);
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${Date.now()}\n`);
      return handle;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      await sleep(POLL_MS);
    }
  }

  throw new Error(
    `Timed out waiting for site build lock (${Math.round(timeoutMs / 1000)}s): ${projectDir}`
  );
}

async function withInProcessBuildQueue<T>(
  projectDir: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = path.resolve(projectDir);
  const previous = inProcessChains.get(key) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  inProcessChains.set(
    key,
    previous.then(() => current)
  );

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (inProcessChains.get(key) === current) {
      inProcessChains.delete(key);
    }
  }
}

/**
 * Serialize `next build` for a site directory across generation worker, preview sync, and API.
 * In-process queue + file lock (cross-process).
 */
export async function withSiteBuildLock<T>(
  projectDir: string,
  fn: () => Promise<T>,
  options?: { timeoutMs?: number }
): Promise<T> {
  return withInProcessBuildQueue(projectDir, async () => {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const lockPath = lockFileForProjectDir(projectDir);
    await fs.mkdir(LOCKS_DIR, { recursive: true });

    const handle = await acquireFileBuildLock(lockPath, projectDir, timeoutMs);
    try {
      await clearNextBuildDirLock(projectDir);
      return await fn();
    } finally {
      await handle.close();
      await fs.unlink(lockPath).catch(() => undefined);
    }
  });
}
