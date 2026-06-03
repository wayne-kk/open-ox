import { createHash } from "node:crypto";
import fs from "fs/promises";
import path from "path";

const LOCKS_DIR = path.join(process.cwd(), ".open-ox", "site-build-locks");

const POLL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;

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

async function readLockPid(lockPath: string): Promise<number | null> {
  try {
    const raw = (await fs.readFile(lockPath, "utf8")).trim();
    const pid = Number(raw.split(/\s/)[0]);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function tryReleaseStaleOpenOxLock(lockPath: string): Promise<void> {
  const pid = await readLockPid(lockPath);
  if (pid != null && isPidAlive(pid)) return;
  await fs.unlink(lockPath).catch(() => undefined);
}

/**
 * Serialize `next build` for a site directory across generation worker, preview sync, and API.
 * Prevents "Unable to acquire lock at .next/lock" when verify-build and static preview overlap.
 */
export async function withSiteBuildLock<T>(
  projectDir: string,
  fn: () => Promise<T>,
  options?: { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lockPath = lockFileForProjectDir(projectDir);
  await fs.mkdir(LOCKS_DIR, { recursive: true });

  const started = Date.now();
  let handle: fs.FileHandle | undefined;

  while (Date.now() - started < timeoutMs) {
    await tryReleaseStaleOpenOxLock(lockPath);
    try {
      handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${Date.now()}\n`);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      await sleep(POLL_MS);
    }
  }

  if (!handle) {
    throw new Error(
      `Timed out waiting for site build lock (${Math.round(timeoutMs / 1000)}s): ${projectDir}`
    );
  }

  try {
    await clearNextBuildDirLock(projectDir);
    return await fn();
  } finally {
    await handle.close();
    await fs.unlink(lockPath).catch(() => undefined);
  }
}
