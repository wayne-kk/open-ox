/**
 * Static site preview: `next build` with OPEN_OX_STATIC_ASSET_PREFIX = full Storage URL to the site root
 * (…/public/site-previews/p/{projectId}, no trailing slash) so `_next` chunks load from the same origin path
 * as `index.html`. Upload flat `out/*` to keys `p/{projectId}/*`.
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

/**
 * Public URL of `index.html` (Supabase object key `p/{projectId}/index.html`).
 * Must match `storage.from(bucket).getPublicUrl(...)` — do not hand-roll paths (encoding + API shape).
 */
export function getStaticPreviewUrl(projectId: string): string {
  const client = createSupabaseServiceRoleClient();
  const objectPath = `p/${projectId}/index.html`;
  const { data } = client.storage.from(SITE_PREVIEWS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

function contentTypeForRelPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".html")) return "text/html";
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

async function collectOutRelativePaths(uploadRoot: string): Promise<string[]> {
  try {
    await fs.access(uploadRoot);
  } catch {
    return [];
  }
  const files = await collectFiles(uploadRoot, uploadRoot);
  return files.map((f) => f.split(path.sep).join("/"));
}

/** Static export with `assetPrefix` writes `out/index.html` and `out/_next/...` at the top level. */
async function resolveFlatOutRoot(outDir: string): Promise<string> {
  try {
    await fs.access(path.join(outDir, "index.html"));
    return outDir;
  } catch {
    throw new Error(`[staticPreview] No out/index.html after build (check OPEN_OX_STATIC_ASSET_PREFIX / next.config)`);
  }
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
  const uploadRoot = await resolveFlatOutRoot(outDir);
  const rels = await collectOutRelativePaths(uploadRoot);
  if (rels.length === 0) {
    throw new Error("Static export produced an empty upload root");
  }

  const admin = storage;

  const uploadOne = async (rel: string): Promise<void> => {
    const localPath = path.join(uploadRoot, ...rel.split("/"));
    const raw = await fs.readFile(localPath);
    const storagePath = `p/${projectId}/${rel}`;
    const contentType = contentTypeForRelPath(rel);
    let lastMessage = "";

    /**
     * Prefer Blob so storage-js uses multipart upload; part media type becomes the object Content-Type.
     * Raw Buffer + headers can leave public objects as text/plain — browsers then show HTML source instead of rendering.
     */
    const fileBody =
      typeof Blob !== "undefined" ? new Blob([raw], { type: contentType }) : raw;

    for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
      const { error } = await admin.storage.from(SITE_PREVIEWS_BUCKET).upload(storagePath, fileBody, {
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

/**
 * Ensure `next.config` includes conditional `assetPrefix` for Storage preview builds.
 * Migrates older repos that only had `OPEN_OX_STATIC_BASE_PATH` / `basePath` (broken for Supabase URLs).
 */
async function ensurePreviewAssetPrefixInNextConfig(projectDir: string): Promise<void> {
  const configPath = path.join(projectDir, "next.config.ts");
  let s: string;
  try {
    s = await fs.readFile(configPath, "utf-8");
  } catch {
    return;
  }
  if (s.includes("OPEN_OX_STATIC_ASSET_PREFIX")) {
    if (s.includes("OPEN_OX_STATIC_BASE_PATH")) {
      const stripped = s
        .replace(
          /\n*\.\.\.\(process\.env\.OPEN_OX_STATIC_BASE_PATH\?\.trim\(\)\s*\n\s*\?\s*\{\s*basePath:\s*process\.env\.OPEN_OX_STATIC_BASE_PATH\.trim\(\)\s*\}\s*:\s*\{\s*\}\),?/g,
          ""
        )
        .replace(/\nconst staticBasePath = process\.env\.OPEN_OX_STATIC_BASE_PATH[^;]*;\n/g, "\n");
      if (stripped !== s) {
        await fs.writeFile(configPath, stripped, "utf-8");
      }
    }
    return;
  }

  // Legacy inject: basePath-only block → remove before adding assetPrefix
  let working = s.replace(
    /\n*\.\.\.\(process\.env\.OPEN_OX_STATIC_BASE_PATH\?\.trim\(\)\s*\n\s*\?\s*\{\s*basePath:\s*process\.env\.OPEN_OX_STATIC_BASE_PATH\.trim\(\)\s*\}\s*:\s*\{\s*\}\),?/g,
    ""
  );
  working = working.replace(/\nconst staticBasePath = process\.env\.OPEN_OX_STATIC_BASE_PATH[^;]*;\n/g, "\n");

  const replaced = working.replace(
    /const nextConfig:\s*NextConfig\s*=\s*\{/,
    `const nextConfig: NextConfig = {
  ...(process.env.OPEN_OX_STATIC_ASSET_PREFIX?.trim()
    ? { assetPrefix: process.env.OPEN_OX_STATIC_ASSET_PREFIX.trim() }
    : {}),`
  );
  if (replaced === working) return;
  await fs.writeFile(configPath, replaced, "utf-8");
}

async function runStaticExportBuild(projectId: string, projectDir: string): Promise<void> {
  const assetPrefix = `${getSitePreviewsObjectBase()}/p/${projectId}`;
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
          OPEN_OX_STATIC_ASSET_PREFIX: assetPrefix,
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
    await ensurePreviewAssetPrefixInNextConfig(projectDir);

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
  const indexUrl = getStaticPreviewUrl(projectId);
  if (await remoteIndexHtmlReachable(indexUrl)) {
    return { status: "ok", url: indexUrl };
  }
  return { status: "down" };
}

export async function getStaticPreviewStatus(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const indexUrl = getStaticPreviewUrl(projectId);
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
    if (await remoteIndexHtmlReachable(indexUrl)) return { status: "running", url: indexUrl };
  } catch {
    /* */
  }
  if (row?.static_preview_synced_at) {
    return { status: "running", url: indexUrl };
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
