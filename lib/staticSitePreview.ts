/**
 * Static site preview: `next build` with `OPEN_OX_STATIC_BASE_PATH=/site-previews/{url-encoded projectId}` so
 * `/_next` chunk URLs resolve under the preview proxy. Files from `public/` stay as `/images/…` in Next's HTML;
 * we rewrite those absolute paths under the sync step before upload. Objects live at Storage keys `p/{projectId}/*`,
 * and the **browser** loads them via `GET /site-previews/{projectId}/...` (see `app/site-previews/.../route.ts`).
 *
 * Supabase public object responses include `Content-Security-Policy: default-src 'none'; sandbox`, which
 * blocks scripts inside an iframe — proxying through this app avoids forwarding that CSP.
 *
 * Env: OPEN_OX_PREVIEW_BACKEND=storage, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SITE_URL (proxy origin). Optional: OPEN_OX_STATIC_UPLOAD_CONCURRENCY (default 8).
 */

import { createHash } from "node:crypto";
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
import {
  getSavedFingerprint,
  parseProjectsFilesHash,
  saveFingerprint,
} from "@/lib/previewFingerprintDb";
import { rewriteExportedPublicRootPathsInText } from "@/lib/staticExportPublicPathRewrite";

const execFileAsync = promisify(execFile);

export const SITE_PREVIEWS_BUCKET = "site-previews";

/** Parallel uploads to Storage (default 8). Raise if stable network; lower if you see `fetch failed`. */
const UPLOAD_CONCURRENCY = (() => {
  const raw = process.env.OPEN_OX_STATIC_UPLOAD_CONCURRENCY?.trim();
  if (!raw) return 8;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(32, n);
})();
const UPLOAD_MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transient errors from undici/fetch (e.g. "fetch failed") or Supabase gateway — worth retrying.
 */
function isRetryableStorageError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("http 5") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("gateway") ||
    lower.includes("temporarily unavailable") ||
    lower === "fetch failed" ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("socket") ||
    lower.includes("network") ||
    lower.includes("aborted") ||
    lower.includes("und_err") ||
    lower.includes("too many") ||
    lower.includes("rate limit")
  );
}

export function getStoragePreviewProxyOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!site) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is required for OPEN_OX_PREVIEW_BACKEND=storage (preview is served via /site-previews proxy)"
    );
  }
  return site;
}

/**
 * Path prefix (leading slash, no trailing slash) matching `OPEN_OX_STATIC_BASE_PATH` / the `/site-previews/...` proxy.
 */
export function getStoragePreviewBasePath(projectId: string): string {
  return `/site-previews/${encodeURIComponent(projectId)}`;
}

/**
 * Browser URL for `index.html` — proxied through this app so Storage’s CSP sandbox does not block scripts.
 */
export function getStaticPreviewUrl(projectId: string): string {
  const origin = getStoragePreviewProxyOrigin();
  return `${origin}${getStoragePreviewBasePath(projectId)}/index.html`;
}

/** Stable 16-char hash of preview proxy origin (NEXT_PUBLIC_SITE_URL) for storage sync skip logic. */
export function storagePreviewOriginFingerprint(): string {
  return createHash("sha256").update(getStoragePreviewProxyOrigin()).digest("hex").slice(0, 16);
}

export function contentTypeForRelPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".apng")) return "image/apng";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

/**
 * Proxy responses set `X-Content-Type-Options: nosniff`, so the type must be correct: unknown extensions
 * cannot fall back to `application/octet-stream` for images/fonts or browsers show broken media.
 * When we cannot infer from the path, use Supabase's `Content-Type` if sensible.
 */
export function resolveProxiedContentType(
  rel: string,
  upstreamContentType: string | null | undefined
): string {
  const mapped = contentTypeForRelPath(rel);
  if (mapped !== "application/octet-stream") {
    return mapped;
  }
  const raw = upstreamContentType?.split(";")[0]?.trim();
  if (!raw) return "application/octet-stream";
  const low = raw.toLowerCase();
  if (low.startsWith("multipart/")) {
    return "application/octet-stream";
  }
  // Storage may label binaries as text/plain; with nosniff that breaks <img>. Only trust text/plain for text-like paths.
  if (low === "text/plain") {
    const l = rel.toLowerCase();
    const textish =
      l.endsWith(".html") ||
      l.endsWith(".css") ||
      l.endsWith(".js") ||
      l.endsWith(".mjs") ||
      l.endsWith(".json") ||
      l.endsWith(".txt") ||
      l.endsWith(".svg") ||
      l.endsWith(".map");
    if (!textish) {
      return "application/octet-stream";
    }
  }
  return raw;
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

/** Static export with optional `basePath` still emits `out/index.html` and `out/_next/...` at the top level (Next 16). */
async function resolveFlatOutRoot(outDir: string): Promise<string> {
  try {
    await fs.access(path.join(outDir, "index.html"));
    return outDir;
  } catch {
    throw new Error(`[staticPreview] No out/index.html after build (check OPEN_OX_STATIC_BASE_PATH / next.config)`);
  }
}

const REWRITABLE_OUT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".map",
  ".txt",
  ".svg",
]);

/**
 * Top-level names under `out/` that are copied from `public/` (or other static roots), excluding Next reserved dirs.
 */
async function discoverOutPublicSegments(outDir: string): Promise<string[]> {
  const entries = await fs.readdir(outDir, { withFileTypes: true });
  const segments: string[] = [];
  for (const ent of entries) {
    if (ent.name.startsWith("_") || ent.name.startsWith(".")) continue;
    if (ent.name === "404.html") continue;
    if (ent.isDirectory()) {
      segments.push(ent.name);
      continue;
    }
    if (ent.isFile()) {
      if (ent.name === "index.html" || ent.name.endsWith(".html")) continue;
      if (ent.name === "index.txt" || ent.name.endsWith(".txt")) continue;
      segments.push(ent.name);
    }
  }
  segments.sort((a, b) => b.length - a.length);
  return segments;
}

async function rewriteExportedPublicPathsInOutDir(outDir: string, basePath: string): Promise<void> {
  const segments = await discoverOutPublicSegments(outDir);
  if (segments.length === 0) return;
  const rels = await collectOutRelativePaths(outDir);
  const todo = rels.filter((rel) => {
    const low = rel.toLowerCase();
    const dot = low.lastIndexOf(".");
    const ext = dot >= 0 ? low.slice(dot) : "";
    return REWRITABLE_OUT_EXTENSIONS.has(ext);
  });
  for (const rel of todo) {
    const full = path.join(outDir, ...rel.split("/"));
    const raw = await fs.readFile(full, "utf-8");
    const next = rewriteExportedPublicRootPathsInText(raw, basePath, segments);
    if (next !== raw) {
      await fs.writeFile(full, next, "utf-8");
    }
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
     * Supabase Storage (multipart) resolves MIME as:
     *   formData.fields.contentType?.value || formData.mimetype
     * (@supabase/storage `fileUploadFromRequest`). `storage-js` Blob uploads only send cacheControl +
     * the file part — no `contentType` field — so `formData.mimetype` often defaults to `text/plain`.
     * Raw Buffer uploads rely on the request `content-type` header; that path can still misbehave behind
     * some proxies. Building FormData with an explicit `contentType` field matches the server contract.
     */
    const fileBytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

    const buildUploadForm = (): FormData => {
      const f = new FormData();
      f.append("cacheControl", "3600");
      f.append("contentType", contentType);
      f.append("", new Blob([fileBytes], { type: contentType }), path.basename(rel));
      return f;
    };

    for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
      const { error } = await admin.storage.from(SITE_PREVIEWS_BUCKET).upload(storagePath, buildUploadForm(), {
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
 * Ensure `next.config` uses `OPEN_OX_STATIC_BASE_PATH` → `basePath` for Storage preview builds.
 * Migrates repos that used `OPEN_OX_STATIC_ASSET_PREFIX` / `assetPrefix`.
 */
async function ensurePreviewBasePathInNextConfig(projectDir: string): Promise<void> {
  const configPath = path.join(projectDir, "next.config.ts");
  let s: string;
  try {
    s = await fs.readFile(configPath, "utf-8");
  } catch {
    return;
  }
  if (s.includes("OPEN_OX_STATIC_BASE_PATH") && !s.includes("OPEN_OX_STATIC_ASSET_PREFIX")) {
    return;
  }

  let working = s;

  working = working.replace(
    /\s*\.\.\.\(process\.env\.OPEN_OX_STATIC_ASSET_PREFIX\?\.trim\(\)\s*\n\s*\? \{ assetPrefix: process\.env\.OPEN_OX_STATIC_ASSET_PREFIX\.trim\(\) \}\s*:\s*\{\}\),?\s*/g,
    ""
  );

  working = working.replace(
    /const staticAssetPrefix = process\.env\.OPEN_OX_STATIC_ASSET_PREFIX\?\.trim\(\);/,
    "const staticBasePath = process.env.OPEN_OX_STATIC_BASE_PATH?.trim();"
  );
  working = working.replace(
    /\.\.\.\(staticAssetPrefix \? \{ assetPrefix: staticAssetPrefix \} : \{\}\)/,
    "...(staticBasePath ? { basePath: staticBasePath } : {})"
  );

  if (!working.includes("OPEN_OX_STATIC_BASE_PATH")) {
    working = working.replace(
      /(const nextConfig:\s*NextConfig\s*=\s*\{\s*\n\s*allowedDevOrigins,)/,
      `$1\n  ...(process.env.OPEN_OX_STATIC_BASE_PATH?.trim()\n    ? { basePath: process.env.OPEN_OX_STATIC_BASE_PATH.trim() }\n    : {}),`
    );
  }

  if (working !== s) {
    await fs.writeFile(configPath, working, "utf-8");
  }
}

async function runStaticExportBuild(projectId: string, projectDir: string): Promise<void> {
  const basePath = getStoragePreviewBasePath(projectId);
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

    const filesFp = await computeProjectFingerprint(projectId);
    const originFp = storagePreviewOriginFingerprint();
    const aggregateKey = `${filesFp}:${originFp}`;
    const url = getStaticPreviewUrl(projectId);

    const saved = parseProjectsFilesHash(await getSavedFingerprint(db, projectId));
    const skip =
      !force &&
      saved.filesFingerprint === filesFp &&
      saved.storageOriginFingerprint !== null &&
      saved.storageOriginFingerprint === originFp;

    if (skip) {
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
      await rewriteExportedPublicPathsInOutDir(outDir, getStoragePreviewBasePath(projectId));
      await uploadOutDir(storage, projectId, outDir);
      await removeLocalOutDir(projectDir);

      await saveFingerprint(db, projectId, aggregateKey);
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
