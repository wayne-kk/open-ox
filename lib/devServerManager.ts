/**
 * Dev Server Manager — Simplified & Reliable
 *
 * State is persisted to .open-ox/dev-servers.json.
 * On each startDevServer call:
 *   1. Check persisted state for this projectId
 *   2. If found and port is alive → reuse
 *   3. Otherwise → spawn new, persist
 *
 * No OS process scanning (unreliable). No in-memory-only state.
 * The persisted file is the single source of truth.
 */

import fs from "fs/promises";
import path from "path";
import net from "net";
import { spawn, ChildProcess } from "child_process";
import { findAvailablePort } from "./portAllocator";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";

const STATE_FILE = path.join(WORKSPACE_ROOT, ".open-ox", "dev-servers.json");

interface PersistedEntry {
  projectId: string;
  port: number;
  url: string;
  pid: number;
}

// In-memory handles for processes we spawned in THIS module lifecycle
const childProcesses = new Map<string, ChildProcess>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, 1000);
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once("error", () => { clearTimeout(timer); resolve(false); });
  });
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status > 0) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 600));
  }
}

function waitForReady(child: ChildProcess, timeoutMs = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Dev server timed out (${timeoutMs / 1000}s). Output:\n${logs.slice(-20).join("")}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      logs.push(text);
      if (text.includes("Ready in") || text.includes("Local:") || text.includes("ready started")) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Dev server exited (code ${code}).\n${logs.slice(-30).join("")}`));
    });
  });
}

// ── Persistence (single source of truth) ─────────────────────────────────────

async function readState(): Promise<PersistedEntry[]> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function writeState(entries: PersistedEntry[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

async function upsertEntry(entry: PersistedEntry): Promise<void> {
  const entries = await readState();
  const idx = entries.findIndex((e) => e.projectId === entry.projectId);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  await writeState(entries);
}

async function removeEntry(projectId: string): Promise<void> {
  const entries = await readState();
  await writeState(entries.filter((e) => e.projectId !== projectId));
}

async function findEntry(projectId: string): Promise<PersistedEntry | null> {
  const entries = await readState();
  return entries.find((e) => e.projectId === projectId) ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startDevServer(
  projectId: string
): Promise<{ url: string; port: number }> {
  const projectDir = getSiteRoot(projectId);
  try { await fs.access(projectDir); } catch {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  // 1. Check persisted state — verify BOTH pid alive AND port listening
  const existing = await findEntry(projectId);
  if (existing) {
    const pidAlive = existing.pid > 0 && isProcessAlive(existing.pid);
    const portUp = pidAlive && await isPortListening(existing.port);
    if (pidAlive && portUp) {
      return { url: existing.url, port: existing.port };
    }
    // Stale entry — kill orphan if pid alive but port wrong, then clean up
    if (pidAlive) {
      try { process.kill(existing.pid, "SIGTERM"); } catch { /* already dead */ }
    }
    await removeEntry(projectId);
  }

  // 2. Spawn new dev server
  const port = await findAvailablePort();
  const url = `http://localhost:${port}`;
  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");

  const child = spawn(nextBin, ["dev", "--port", String(port)], {
    cwd: projectDir,
    stdio: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  childProcesses.set(projectId, child);

  child.on("exit", () => {
    childProcesses.delete(projectId);
    removeEntry(projectId);
  });

  try {
    await waitForReady(child);
    await waitForHttp(url);
  } catch (err) {
    child.kill("SIGTERM");
    childProcesses.delete(projectId);
    await removeEntry(projectId);
    throw err;
  }

  await upsertEntry({ projectId, port, url, pid: child.pid ?? 0 });
  return { url, port };
}

export async function stopDevServer(projectId: string): Promise<void> {
  // Try in-memory handle first
  const child = childProcesses.get(projectId);
  if (child) {
    child.kill("SIGTERM");
    childProcesses.delete(projectId);
  }

  // Also try persisted PID
  const entry = await findEntry(projectId);
  if (entry?.pid) {
    try { process.kill(entry.pid, "SIGTERM"); } catch { /* already dead */ }
  }

  await removeEntry(projectId);
}

export async function getDevServerStatus(
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const entry = await findEntry(projectId);
  if (!entry) return { status: "stopped" };
  const alive = await isPortListening(entry.port);
  if (!alive) {
    await removeEntry(projectId);
    return { status: "stopped" };
  }
  return { status: "running", url: entry.url };
}

export async function listDevServers(): Promise<
  Array<{ projectId: string; port: number; url: string; status: string; alive: boolean }>
> {
  const entries = await readState();
  const results = [];
  for (const entry of entries) {
    const alive = await isPortListening(entry.port);
    results.push({
      projectId: entry.projectId,
      port: entry.port,
      url: entry.url,
      status: alive ? "running" : "stopped",
      alive,
    });
  }
  return results;
}
