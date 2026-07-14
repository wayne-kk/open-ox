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
import { ensureGeneratedSiteTurbopackRoot } from "@/lib/ensureGeneratedSiteTurbopackRoot";
import { ensureProjectNodeModules } from "@/lib/ensureProjectNodeModules";
import { envForNextWebpackChild } from "@/lib/nextWebpackChildEnv";
import { withSiteBuildLock } from "@/lib/siteBuildLock";
import { getSiteRoot } from "@/lib/projectManager";
import { ensureProjectSourcesOnDisk } from "@/lib/storage";
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
import { canUseInstantStaticPreview } from "@/lib/staticSitePreviewFastPath";
import {
  canReuseStaticExportOut,
  writeStaticPreviewBuildStamp,
} from "@/lib/staticPreviewBuildStamp";
import {
  resolveInFlightSyncPolicy,
  staticExportFingerprintDrifted,
} from "@/lib/staticSitePreviewInFlight";
import { rewriteExportedPublicRootPathsInText } from "@/lib/staticExportPublicPathRewrite";
import {
  contentTypeForRelPath,
  resolveProxiedContentType,
} from "@/lib/staticSitePreviewProxyMime";

export { contentTypeForRelPath, resolveProxiedContentType };

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
 * Browser entry URL for static Storage preview — proxied through this app (no `index.html` in the path;
 * `app/site-previews/.../route` serves `index.html` when the path segment is empty).
 *
 * No trailing slash: Next defaults to `trailingSlash: false` and 308s `/site-previews/id/` →
 * `/site-previews/id`. Returning the canonical form avoids an extra redirect before the iframe paints.
 */
export function getStaticPreviewUrl(projectId: string): string {
  const origin = getStoragePreviewProxyOrigin();
  return `${origin}${getStoragePreviewBasePath(projectId)}`;
}

/**
 * Direct Supabase public object URL for a preview file (bypasses the auth-gated `/site-previews` proxy).
 * Used for server-side health checks — probing the proxy without the owner's cookies falsely 403s private projects.
 */
export function getStoragePreviewPublicObjectUrl(projectId: string, rel = "index.html"): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to probe site-previews storage");
  }
  const encodedPath = `p/${projectId}/${rel}`
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${SITE_PREVIEWS_BUCKET}/${encodedPath}`;
}

/** Stable 16-char hash of preview proxy origin (NEXT_PUBLIC_SITE_URL) for storage sync skip logic. */
export function storagePreviewOriginFingerprint(): string {
  return createHash("sha256").update(getStoragePreviewProxyOrigin()).digest("hex").slice(0, 16);
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

/**
 * Strip legacy `next build --webpack` from older generated sites.
 * Production builds use Turbopack; webpack is only for Design Mode `next dev`.
 */
async function ensureTurbopackBuildScript(projectDir: string): Promise<void> {
  const pkgPath = path.join(projectDir, "package.json");
  let raw: string;
  try {
    raw = await fs.readFile(pkgPath, "utf-8");
  } catch {
    return;
  }
  let pkg: { scripts?: Record<string, string>; [k: string]: unknown };
  try {
    pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  } catch {
    return;
  }
  const build = pkg.scripts?.build?.trim() ?? "";
  if (!build) {
    pkg.scripts = { ...pkg.scripts, build: "next build" };
  } else if (build === "next build --webpack" || build === "npx next build --webpack") {
    pkg.scripts = { ...pkg.scripts, build: "next build" };
  } else {
    return;
  }
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
}

/**
 * Patch next.config / package.json so Storage static export builds succeed.
 * Exported for modify verification to build once with the same basePath as preview sync.
 */
export async function prepareProjectDirForStaticExport(projectDir: string): Promise<void> {
  await ensurePreviewBasePathInNextConfig(projectDir);
  await ensureGeneratedSiteTurbopackRoot(projectDir);
  await ensureTurbopackBuildScript(projectDir);
}

async function runStaticExportBuild(projectId: string, projectDir: string): Promise<void> {
  const basePath = getStoragePreviewBasePath(projectId);
  await withSiteBuildLock(projectDir, async () => {
    let stdout = "";
    let stderr = "";
    try {
      // Turbopack (`next build`) with site-isolated turbopack.root — see
      // ensureGeneratedSiteTurbopackRoot. Design Mode still uses `next dev --webpack`.
      const result = await execFileAsync(
        "pnpm",
        ["exec", "next", "build"],
        {
          cwd: projectDir,
          env: envForNextWebpackChild({
            NODE_ENV: "production",
            OPEN_OX_STATIC_BASE_PATH: basePath,
          }),
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
  });
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

type StaticPreviewRow = {
  files_hash: string | null;
  static_preview_synced_at: string | null;
  static_preview_last_error: string | null;
};

async function loadStaticPreviewRow(
  db: SupabaseClient,
  projectId: string
): Promise<StaticPreviewRow | null> {
  const { data } = await db
    .from("projects")
    .select("files_hash, static_preview_synced_at, static_preview_last_error")
    .eq("id", projectId)
    .single();
  return (data as StaticPreviewRow | null) ?? null;
}

/**
 * Instant return when static export is already published — no Storage restore, no rebuild.
 */
export async function getExistingStoragePreviewUrl(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; port: number } | null> {
  const row = await loadStaticPreviewRow(db, projectId);
  let diskFp: string | null = null;
  try {
    diskFp = await computeProjectFingerprint(projectId);
  } catch {
    diskFp = null;
  }
  if (
    !canUseInstantStaticPreview({
      filesHash: row?.files_hash ?? null,
      staticPreviewSyncedAt: row?.static_preview_synced_at ?? null,
      currentOriginFingerprint: storagePreviewOriginFingerprint(),
      currentFilesFingerprint: diskFp,
    })
  ) {
    return null;
  }

  return { url: getStaticPreviewUrl(projectId), port: 0 };
}

async function tryInstantStaticPreviewReturn(
  db: SupabaseClient,
  projectId: string,
  force: boolean
): Promise<{ url: string; port: number; skipped: true } | null> {
  const row = await loadStaticPreviewRow(db, projectId);
  let diskFp: string | null = null;
  try {
    diskFp = await computeProjectFingerprint(projectId);
  } catch {
    diskFp = null;
  }
  if (
    !canUseInstantStaticPreview({
      force,
      filesHash: row?.files_hash ?? null,
      staticPreviewSyncedAt: row?.static_preview_synced_at ?? null,
      currentOriginFingerprint: storagePreviewOriginFingerprint(),
      currentFilesFingerprint: diskFp,
    })
  ) {
    return null;
  }

  const url = getStaticPreviewUrl(projectId);
  console.log(`[staticPreview] instant (skip restore+build) projectId=${projectId}`);
  return { url, port: 0, skipped: true };
}

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
  const inFlightPolicy = resolveInFlightSyncPolicy({
    hasInFlight: Boolean(existing),
    force,
  });
  if (inFlightPolicy === "join" && existing) {
    return existing;
  }
  if (inFlightPolicy === "wait-then-run" && existing) {
    // Mid-gen stub sync must not satisfy post-gen / Rebuild(force). Wait it out, then rebuild.
    try {
      await existing;
    } catch {
      /* prior sync failed — continue with force rebuild */
    }
  }

  const promise = (async () => {
    const instant = await tryInstantStaticPreviewReturn(db, projectId, force);
    if (instant) {
      return instant;
    }

    const projectDir = getSiteRoot(projectId);
    await ensureProjectSourcesOnDisk(projectId, { db });
    try {
      await fs.access(path.join(projectDir, "package.json"));
    } catch {
      throw new Error(`Project directory not found: ${projectDir}`);
    }

    await ensureGlobalErrorFromTemplateForProject(projectId);
    await prepareProjectDirForStaticExport(projectDir);

    let filesFp = await computeProjectFingerprint(projectId);
    const originFp = storagePreviewOriginFingerprint();
    const url = getStaticPreviewUrl(projectId);
    const basePath = getStoragePreviewBasePath(projectId);

    const saved = parseProjectsFilesHash(await getSavedFingerprint(db, projectId));
    const skip =
      !force &&
      Boolean((await loadStaticPreviewRow(db, projectId))?.static_preview_synced_at) &&
      saved.filesFingerprint === filesFp &&
      saved.storageOriginFingerprint !== null &&
      saved.storageOriginFingerprint === originFp;

    if (skip) {
      console.log(`[staticPreview] skip rebuild (fingerprint match) projectId=${projectId}`);
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

      // One retry if sources changed during the long `next build` (stub → real page).
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const reuseOut = await canReuseStaticExportOut(projectDir, filesFp, basePath);
        if (reuseOut) {
          console.log(
            `[staticPreview] reuse existing out/ (verification stamp) projectId=${projectId}`
          );
        } else {
          await runStaticExportBuild(projectId, projectDir);
        }

        const filesFpAfter = await computeProjectFingerprint(projectId);
        if (!staticExportFingerprintDrifted(filesFp, filesFpAfter)) {
          await writeStaticPreviewBuildStamp(projectDir, {
            filesFingerprint: filesFp,
            basePath,
            builtAt: new Date().toISOString(),
          });
          break;
        }

        console.warn(
          `[staticPreview] fingerprint drifted during build (stub→real?) ` +
            `projectId=${projectId} attempt=${attempt + 1} ` +
            `before=${filesFp} after=${filesFpAfter}`
        );
        filesFp = filesFpAfter;
        if (attempt === 1) {
          await writeStaticPreviewBuildStamp(projectDir, {
            filesFingerprint: filesFp,
            basePath,
            builtAt: new Date().toISOString(),
          });
        }
      }

      const aggregateKey = `${filesFp}:${originFp}`;
      const outDir = path.join(projectDir, "out");
      await rewriteExportedPublicPathsInOutDir(outDir, basePath);
      await uploadOutDir(storage, projectId, outDir);
      // Mark synced before deleting local out/ — otherwise a late failure leaves Storage
      // populated while static_preview_synced_at stays null (health used to false-down).
      await saveFingerprint(db, projectId, aggregateKey);
      await persistSyncOk(db, projectId);
      await removeLocalOutDir(projectDir);

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
    // Only clear if we still own this slot — a force waiter may have replaced us.
    if (inFlight.get(projectId) === promise) {
      inFlight.delete(projectId);
    }
  }
}

/**
 * Probe Storage directly (not `/site-previews` proxy). The proxy requires owner/publish cookies;
 * a server-side fetch without them returns 403 for private projects and falsely marks preview down.
 */
async function remoteIndexHtmlReachable(projectId: string): Promise<boolean> {
  let storageUrl: string;
  try {
    storageUrl = getStoragePreviewPublicObjectUrl(projectId, "index.html");
  } catch {
    return false;
  }
  try {
    const res = await fetch(storageUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    if (res.ok) return true;
    // Supabase may reject HEAD; some gateways return 400 for missing keys — only GET confirms.
    if (res.status === 405 || res.status === 400 || res.status === 403 || res.status === 404) {
      const get = await fetch(storageUrl, { method: "GET", signal: AbortSignal.timeout(10_000) });
      return get.ok;
    }
  } catch {
    /* */
  }
  return false;
}

export async function ensureStaticPreviewAlive(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "ok" | "down"; url?: string }> {
  const indexUrl = getStaticPreviewUrl(projectId);
  if (await remoteIndexHtmlReachable(projectId)) {
    return { status: "ok", url: indexUrl };
  }
  // Storage HEAD/GET can flake. If we already published, keep serving —
  // wiping the iframe on tab switch causes a black flash and a pointless restart.
  const row = await loadStaticPreviewRow(db, projectId);
  if (row?.static_preview_synced_at) {
    return { status: "ok", url: indexUrl };
  }
  return { status: "down" };
}

export async function getStaticPreviewStatus(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: "running" | "stopped"; url?: string }> {
  const indexUrl = getStaticPreviewUrl(projectId);
  const row = await loadStaticPreviewRow(db, projectId);

  if (row?.static_preview_last_error && !row?.static_preview_synced_at) {
    return { status: "stopped" };
  }

  try {
    if (await remoteIndexHtmlReachable(projectId)) return { status: "running", url: indexUrl };
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
