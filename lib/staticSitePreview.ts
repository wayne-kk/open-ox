/**
 * Static site preview: `next build` with OPEN_OX_STATIC_BASE_PATH=/p/{projectId}, upload `out/` to
 * Supabase Storage bucket `site-previews`, public URL
 * {SUPABASE_URL}/storage/v1/object/public/site-previews/p/{projectId}/...
 *
 * Env: OPEN_OX_PREVIEW_BACKEND=storage, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from "fs/promises";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { ensureProjectNodeModules, getSiteRoot } from "@/lib/projectManager";
import { restoreProjectFiles } from "@/lib/storage";
import {
  computeProjectFingerprint,
  ensureGlobalErrorFromTemplateForProject,
  collectFiles,
} from "@/lib/previewShared";
import { getSavedFingerprint, saveFingerprint } from "@/lib/previewFingerprintDb";

const execFileAsync = promisify(execFile);

export const SITE_PREVIEWS_BUCKET = "site-previews";

const UPLOAD_CONCURRENCY = 20;
const UPLOAD_MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStorageError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("http 5") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("gateway") ||
    lower.includes("temporarily unavailable")
  );
}

/** Public base: .../storage/v1/object/public/site-previews (no trailing slash). */
export function getSitePreviewsObjectBase(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for storage preview");
  }
  return `${base}/storage/v1/object/public/${SITE_PREVIEWS_BUCKET}`;
}

/** User-facing preview origin (fixed prefix), trailing slash for iframe / screenshots. */
export function getStaticPreviewUrl(projectId: string): string {
  const base = getSitePreviewsObjectBase();
  return `${base}/p/${encodeURIComponent(projectId)}/`;
}

function contentTypeForRelPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function collectOutRelativePaths(outDir: string): Promise<string[]> {
  try {
    await fs.access(outDir);
  } catch {
    return [];
  }
  const files = await collectFiles(outDir, outDir);
  return files.map((f) => f.split(path.sep).join("/"));
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => worker(item)));
  }
}

async function uploadOutDir(
  storage: SupabaseClient,
  projectId: string,
  outDir: string
): Promise<void> {
  const rels = await collectOutRelativePaths(outDir);
  if (rels.length === 0) {
    throw new Error("Static export produced an empty `out` directory");
  }

  const admin = storage;

  const uploadOne = async (rel: string): Promise<void> => {
    const localPath = path.join(outDir, ...rel.split("/"));
    const body = await fs.readFile(localPath);
    const storagePath = `p/${projectId}/${rel}`;
    const contentType = contentTypeForRelPath(rel);
    let lastMessage = "";

    for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
      const { error } = await admin.storage.from(SITE_PREVIEWS_BUCKET).upload(storagePath, body, {
        upsert: true,
        contentType,
      });
      if (!error) return;

      lastMessage = error.message ?? "upload error";
      const retry = attempt < UPLOAD_MAX_RETRIES && isRetryableStorageError(lastMessage);
      if (!retry) {
        throw new Error(`[staticPreview] Upload failed ${storagePath}: ${lastMessage}`);
      }
      await sleep(250 * 2 ** attempt);
    }
    throw new Error(`[staticPreview] Upload failed ${storagePath}: ${lastMessage}`);
  };

  await runInBatches(rels, UPLOAD_CONCURRENCY, uploadOne);
}

async function removeLocalOutDir(projectDir: string): Promise<void> {
  const outDir = path.join(projectDir, "out");
  await fs.rm(outDir, { recursive: true, force: true });
}

/** Older `sites/{id}` trees may predate template `basePath` support; inject a no-op spread when env unset. */
async function ensurePreviewBasePathInNextConfig(projectDir: string): Promise<void> {
  const configPath = path.join(projectDir, "next.config.ts");
  let s: string;
  try {
    s = await fs.readFile(configPath, "utf-8");
  } catch {
    return;
  }
  if (s.includes("OPEN_OX_STATIC_BASE_PATH")) return;
  const replaced = s.replace(
    /const nextConfig:\s*NextConfig\s*=\s*\{/,
    `const nextConfig: NextConfig = {
  ...(process.env.OPEN_OX_STATIC_BASE_PATH?.trim()
    ? { basePath: process.env.OPEN_OX_STATIC_BASE_PATH.trim() }
    : {}),`
  );
  if (replaced === s) return;
  await fs.writeFile(configPath, replaced, "utf-8");
}

async function runStaticExportBuild(projectId: string, projectDir: string): Promise<void> {
  const basePath = `/p/${projectId}`;
  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync(
      "pnpm",
      ["run", "build"],
      {
        cwd: projectDir,
        env: {
          ...process.env,
          NODE_ENV: "production",
          OPEN_OX_STATIC_BASE_PATH: basePath,
        },
        maxBuffer: 12 * 1024 * 1024,
      }
    );
    stdout = result.stdout?.toString() ?? "";
    stderr = result.stderr?.toString() ?? "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const ex = err as { stdout?: string; stderr?: string };
    const tail = [ex.stderr, ex.stdout, msg].filter(Boolean).join("\n").slice(-4000);
    throw new Error(`next build (static preview) failed: ${tail}`);
  }
  if (stderr && /error|failed/i.test(stderr) && !/compiled successfully/i.test(stdout)) {
    console.warn("[staticPreview] build stderr:", stderr.slice(-2000));
  }
}

async function persistSyncOk(db: SupabaseClient, projectId: string): Promise<void> {
  await db
    .from("projects")
    .update({
      static_preview_synced_at: new Date().toISOString(),
      static_preview_last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

async function persistSyncError(db: SupabaseClient, projectId: string, message: string): Promise<void> {
  await db
    .from("projects")
    .update({
      static_preview_last_error: message.slice(0, 4000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
}

const inFlight = new Map<string, Promise<{ url: string; port: number; skipped?: boolean }>>();

export type SyncStaticPreviewOptions = {
  /** Skip fingerprint short-circuit (always rebuild + upload). */
  force?: boolean;
};

/**
 * Restore sources, optionally rebuild static export with basePath, upload `out/`, delete local `out/`,
 * update files_hash + DB sync columns.
 */
export async function syncStaticSitePreview(
  db: SupabaseClient,
  projectId: string,
  options?: SyncStaticPreviewOptions
): Promise<{ url: string; port: number; skipped?: boolean }> {
  const force = options?.force === true;
  const existing = inFlight.get(projectId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const projectDir = getSiteRoot(projectId);
    await restoreProjectFiles(projectId);
    try {
      await fs.access(path.join(projectDir, "package.json"));
    } catch {
      throw new Error(`Project directory not found: ${projectDir}`);
    }

    await ensureGlobalErrorFromTemplateForProject(projectId);
    await ensurePreviewBasePathInNextConfig(projectDir);

    const currentHash = await computeProjectFingerprint(projectId);
    const savedHash = await getSavedFingerprint(db, projectId);
    const url = getStaticPreviewUrl(projectId);

    if (!force && savedHash !== null && currentHash === savedHash) {
      return { url, port: 0, skipped: true };
    }

    let storage: SupabaseClient;
    try {
      storage = createSupabaseServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await persistSyncError(db, projectId, msg);
      throw e;
    }

    try {
      await ensureProjectNodeModules(projectDir);
      await runStaticExportBuild(projectId, projectDir);

      const outDir = path.join(projectDir, "out");
      await uploadOutDir(storage, projectId, outDir);
      await removeLocalOutDir(projectDir);

      await saveFingerprint(db, projectId, currentHash);
      await persistSyncOk(db, projectId);

      return { url, port: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await persistSyncError(db, projectId, msg);
      throw err;
    }
  })();

  inFlight.set(projectId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(projectId);
  }
}

async function remoteIndexHtmlReachable(indexUrl: string): Promise<boolean> {
  try {
    const res = await fetch(indexUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    if (res.ok) return true;
    if (res.status === 405) {
      const get = await fetch(indexUrl, { method: "GET", signal: AbortSignal.timeout(10_000) });
      return get.ok;
    }
  } catch {
    /* */
  }
  return false;
}

export async function ensureStaticPreviewAlive(
  _db: SupabaseClient,
  projectId: string
): Promise<{ status: "ok" | "down"; url?: string }> {
  const url = getStaticPreviewUrl(projectId);
  const indexUrl = `${url}index.html`;
  if (await remoteIndexHtmlReachable(indexUrl)) {
    return { status: "ok", url };
  }
  return { status: "down" };
}

export async function getStaticPreviewStatus(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const url = getStaticPreviewUrl(projectId);
  const { data } = await db
    .from("projects")
    .select("static_preview_synced_at, static_preview_last_error")
    .eq("id", projectId)
    .single();
  const row = data as {
    static_preview_synced_at: string | null;
    static_preview_last_error: string | null;
  } | null;

  if (row?.static_preview_last_error && !row?.static_preview_synced_at) {
    return { status: "stopped" };
  }

  try {
    const indexUrl = `${url}index.html`;
    if (await remoteIndexHtmlReachable(indexUrl)) return { status: "running", url };
  } catch {
    /* */
  }
  if (row?.static_preview_synced_at) {
    return { status: "running", url };
  }
  return { status: "stopped" };
}

export function scheduleStaticSitePreviewSync(projectId: string): void {
  void (async () => {
    try {
      const db = createSupabaseServiceRoleClient();
      await syncStaticSitePreview(db, projectId);
      console.log(`[staticPreview] scheduled sync ok: ${projectId}`);
    } catch (e) {
      console.error(`[staticPreview] scheduled sync failed: ${projectId}`, e);
    }
  })();
}
