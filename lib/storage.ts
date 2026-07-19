/**
 * Project file storage — Supabase Storage bucket: "project-files"
 *
 * Layout:
 *   project-files/{projectId}/{relativePath}
 *
 * Fast restore: `.open-ox/manifest.json` (file list in one GET) +
 * `.open-ox/snapshot.zip` (single GET then local extract).
 */

import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { computeProjectFingerprint } from "./previewShared";
import { getSavedFingerprint, parseProjectsFilesHash } from "./previewFingerprintDb";
import { isPreparingSiteHomePageStub } from "./preparingSiteHomePageStub";
import { getProjectFilesStorageClient } from "./projectFilesStorageClient";
import { createSupabaseServiceRoleClient } from "./supabase/service-role";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";

const BUCKET = "project-files";
const STORAGE_UPLOAD_EXCLUDE = new Set(["node_modules", ".next", ".git", "out", ".open-ox"]);
const STORAGE_UPLOAD_EXCLUDE_PREFIXES = ["components/ui/"];
const STORAGE_UPLOAD_CONCURRENCY = 20;
/** Bounded concurrency for manifest-guided per-file restores (fewer sockets than naive Promise.all). */
const MANIFEST_RESTORE_CONCURRENCY = 16;
const STORAGE_UPLOAD_MAX_RETRIES = 4;
const TEMPLATE_RESTORE_EXCLUDE = new Set([
  "components/sections",
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "design-system.md",
  ".git",
  ".next",
  "node_modules",
  "pnpm-lock.yaml",
  "tsconfig.tsbuildinfo",
]);

const MANIFEST_REL = ".open-ox/manifest.json";
const SNAPSHOT_ZIP_REL = ".open-ox/snapshot.zip";
const SNAPSHOT_MANIFEST_VERSION = 1;

/** Paths always upserted; never prune as “stale” when comparing to local crawl. */
const PROTECTED_SNAPSHOT_OBJECTS = new Set([MANIFEST_REL, SNAPSHOT_ZIP_REL]);

type SnapshotManifestJson = {
  v: number;
  generatedAt?: string;
  files: string[];
};

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

/** Upload a single local file to Supabase Storage */
export async function uploadProjectFile(
  projectId: string,
  relativeFilePath: string
): Promise<void> {
  const localPath = path.join(getSiteRoot(projectId), relativeFilePath);
  const content = await fs.readFile(localPath);
  await uploadProjectFileContent(projectId, relativeFilePath, content);
}

/** Upload file content directly (no local file required) */
export async function uploadProjectFileContent(
  projectId: string,
  relativeFilePath: string,
  content: Buffer | string,
  options?: { contentType?: string }
): Promise<void> {
  const storagePath = `${projectId}/${relativeFilePath}`;
  const body = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= STORAGE_UPLOAD_MAX_RETRIES; attempt += 1) {
    const uploadOpts: { upsert: boolean; contentType?: string } = { upsert: true };
    if (options?.contentType) {
      uploadOpts.contentType = options.contentType;
    }
    const { error } = await getProjectFilesStorageClient().storage.from(BUCKET).upload(storagePath, body, uploadOpts);

    if (!error) {
      return;
    }

    lastErrorMessage = error.message ?? "unknown storage upload error";
    const shouldRetry =
      attempt < STORAGE_UPLOAD_MAX_RETRIES && isRetryableStorageError(lastErrorMessage);

    if (!shouldRetry) {
      throw new Error(`[storage] Failed to upload ${storagePath}: ${lastErrorMessage}`);
    }

    const delayMs = 250 * 2 ** attempt;
    await sleep(delayMs);
  }

  throw new Error(`[storage] Failed to upload ${storagePath}: ${lastErrorMessage}`);
}

/** Same bucket as uploads; callers pass a Supabase client (e.g. service role). */
export async function uploadCoverScreenshot(
  db: Pick<SupabaseClient, "storage">,
  projectId: string,
  jpeg: Buffer,
  options?: { maxRetries?: number }
): Promise<string> {
  const relativePath = ".open-ox-cover/cover.jpg";
  const storagePath = `${projectId}/${relativePath}`;
  const maxRetries =
    typeof options?.maxRetries === "number" && Number.isFinite(options?.maxRetries) && options.maxRetries >= 0
      ? Math.floor(options.maxRetries)
      : STORAGE_UPLOAD_MAX_RETRIES;
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { error } = await db.storage.from(BUCKET).upload(storagePath, jpeg, {
      upsert: true,
      contentType: "image/jpeg",
    });

    if (!error) return relativePath;

    lastErrorMessage = error.message ?? "unknown storage upload error";
    const shouldRetry = attempt < maxRetries && isRetryableStorageError(lastErrorMessage);
    if (!shouldRetry) {
      throw new Error(`[storage] Cover upload failed for ${storagePath}: ${lastErrorMessage}`);
    }
    await sleep(250 * 2 ** attempt);
  }

  throw new Error(`[storage] Cover upload failed for ${storagePath}: ${lastErrorMessage}`);
}

/** Upload all generated files for a project */
export async function uploadGeneratedFiles(
  projectId: string,
  generatedFiles: string[]
): Promise<void> {
  await Promise.all(generatedFiles.map((f) => uploadProjectFile(projectId, f)));
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

async function collectProjectFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (STORAGE_UPLOAD_EXCLUDE.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) continue;
        files.push(path.relative(base, fullPath));
      } catch {
        // broken symlink, skip
      }
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await collectProjectFiles(fullPath, base)));
      continue;
    }

    if (entry.isFile()) {
      const relativePath = path.relative(base, fullPath).split(path.sep).join("/");
      const shouldSkip = STORAGE_UPLOAD_EXCLUDE_PREFIXES.some((prefix) =>
        relativePath.startsWith(prefix)
      );
      if (shouldSkip) continue;
      files.push(relativePath);
    }
  }

  return files;
}

async function buildProjectZipBuffer(projectRoot: string, relativePaths: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err: Error) => reject(err));
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    try {
      const sorted = [...relativePaths].sort();
      for (const rel of sorted) {
        const norm = rel.split(path.sep).join("/");
        archive.file(path.join(projectRoot, ...norm.split("/")), { name: norm });
      }
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    void archive.finalize();
  });
}

async function downloadStorageBlob(storagePath: string): Promise<Blob | null> {
  const { data, error } = await getProjectFilesStorageClient().storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    return null;
  }
  return data;
}

async function fetchSnapshotManifestParsed(projectId: string): Promise<SnapshotManifestJson | null> {
  const blob = await downloadStorageBlob(`${projectId}/${MANIFEST_REL}`);
  if (!blob) return null;
  try {
    const raw = typeof blob.text === "function" ? await blob.text() : Buffer.from(await blob.arrayBuffer()).toString("utf-8");
    const parsed = JSON.parse(raw) as Partial<SnapshotManifestJson>;
    if (
      parsed.v !== SNAPSHOT_MANIFEST_VERSION ||
      !Array.isArray(parsed.files) ||
      parsed.files.length === 0
    ) {
      return null;
    }
    const files = parsed.files
      .filter((f): f is string => typeof f === "string" && f.length > 0)
      .map((f) => f.replace(/\\/g, "/"))
      .filter(isSafeRestoreRelativePath);
    if (!files.length) return null;
    return { v: SNAPSHOT_MANIFEST_VERSION, generatedAt: parsed.generatedAt, files };
  } catch {
    return null;
  }
}

/** Remote index for stale-object pruning — manifest when present avoids recursive list (same cost model as preview). */
async function getRemoteRelativePathsForPrune(projectId: string): Promise<string[]> {
  const m = await fetchSnapshotManifestParsed(projectId);
  if (m?.files?.length) {
    return [...new Set([...m.files, MANIFEST_REL, SNAPSHOT_ZIP_REL])];
  }
  return listProjectFiles(projectId);
}

function isSafeRestoreRelativePath(rel: string): boolean {
  if (!rel.trim()) return false;
  const n = rel.replace(/\\/g, "/");
  if (n.startsWith("/") || n.includes("\0")) return false;
  const parts = n.split("/");
  if (parts.some((p) => p === "..")) return false;
  return true;
}

/**
 * Download a single object from Storage into `sites/{projectId}/…` without running a full
 * snapshot/manifest/legacy restore. Used by preview file reads to avoid 10–60s full-tree syncs.
 */
export async function restoreSingleProjectFileFromStorage(
  projectId: string,
  relativePath: string
): Promise<boolean> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^(\.\/)+/, "").trim();
  if (!normalized || !isSafeRestoreRelativePath(normalized)) return false;
  const storagePath = `${projectId}/${normalized}`;
  const blob = await downloadStorageBlob(storagePath);
  if (!blob) return false;
  const projectRoot = getSiteRoot(projectId);
  const localPath = path.join(projectRoot, ...normalized.split("/"));
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const buf = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(localPath, buf);
  return true;
}

/**
 * Copy one file from `sites/template` when present. Bulk template sync skips some paths
 * (e.g. `design-system.md` via {@link TEMPLATE_RESTORE_EXCLUDE}); explicit single-file copy
 * is used for editor/preview reads.
 */
export async function copyTemplateFileIntoProjectIfPresent(
  projectId: string,
  relativePath: string
): Promise<boolean> {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  if (!normalized || !isSafeRestoreRelativePath(normalized)) return false;
  const templateRoot = path.join(WORKSPACE_ROOT, "sites", "template");
  const src = path.join(templateRoot, ...normalized.split("/"));
  const dest = path.join(getSiteRoot(projectId), ...normalized.split("/"));
  try {
    const st = await fs.stat(src);
    if (!st.isFile()) return false;
  } catch {
    return false;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return true;
}

async function restoreFromSnapshotZip(
  projectId: string,
  projectRoot: string
): Promise<{ ok: true; files: string[] } | { ok: false; reason: string }> {
  const blob = await downloadStorageBlob(`${projectId}/${SNAPSHOT_ZIP_REL}`);
  if (!blob) {
    return { ok: false, reason: "snapshot_zip_not_found_or_forbidden" };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(await blob.arrayBuffer());
  } catch {
    return { ok: false, reason: "snapshot_zip_read_buffer_failed" };
  }
  if (buf.length < 4 || buf.readUInt16LE(0) !== 0x4b50) {
    return { ok: false, reason: "snapshot_zip_not_pk_zip" };
  }

  try {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    const written: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, "/");
      if (!isSafeRestoreRelativePath(name)) continue;
      const data = entry.getData();
      if (!data?.length && name.length > 0) continue;
      if (await writeRestoredFileIfSafe(projectRoot, name, data)) {
        written.push(name);
      }
    }

    try {
      await fs.access(path.join(projectRoot, "package.json"));
    } catch {
      return { ok: false, reason: `snapshot_zip_missing_package_json_after_extract(wrote=${written.length})` };
    }
    return { ok: true, files: written.sort() };
  } catch {
    return { ok: false, reason: "snapshot_zip_unzip_threw" };
  }
}

async function restoreFromManifestBatchedDownloads(
  projectId: string,
  projectRoot: string,
  files: string[]
): Promise<string[]> {
  const unique = [...new Set(files)].filter(isSafeRestoreRelativePath);
  const restored: string[] = [];
  await runInBatches(unique, MANIFEST_RESTORE_CONCURRENCY, async (relativePath) => {
    const storagePath = `${projectId}/${relativePath}`;
    const { data, error } = await getProjectFilesStorageClient().storage.from(BUCKET).download(storagePath);
    if (error || !data) return;
    const buffer = Buffer.from(await data.arrayBuffer());
    if (await writeRestoredFileIfSafe(projectRoot, relativePath, buffer)) {
      restored.push(relativePath);
    }
  });
  restored.sort();
  return restored;
}

async function invalidateStaticPreviewIfSourcesChanged(projectId: string): Promise<void> {
  try {
    const db = createSupabaseServiceRoleClient();
    const newFp = await computeProjectFingerprint(projectId);
    const { data } = await db
      .from("projects")
      .select("files_hash, static_preview_synced_at")
      .eq("id", projectId)
      .single();
    const row = data as { files_hash: string | null; static_preview_synced_at: string | null } | null;
    if (!row?.static_preview_synced_at) return;

    const saved = parseProjectsFilesHash(row.files_hash);
    if (saved.filesFingerprint === newFp) return;

    await db
      .from("projects")
      .update({
        static_preview_synced_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    console.log(
      `[storage] static preview invalidated (sources changed) projectId=${projectId} ` +
        `savedFp=${saved.filesFingerprint ?? "null"} newFp=${newFp}`
    );
  } catch {
    /* non-fatal */
  }
}

/** Upload the complete local project tree so cross-device restore is consistent */
export async function uploadFullProject(projectId: string): Promise<string[]> {
  const projectRoot = getSiteRoot(projectId);
  const files = await collectProjectFiles(projectRoot, projectRoot);
  files.sort();
  const localSet = new Set(files);

  const storageFilesBefore = await getRemoteRelativePathsForPrune(projectId);

  await runInBatches(files, STORAGE_UPLOAD_CONCURRENCY, async (relativePath) => {
    await uploadProjectFile(projectId, relativePath);
  });

  const manifestPayload: SnapshotManifestJson = {
    v: SNAPSHOT_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    files,
  };
  await uploadProjectFileContent(
    projectId,
    MANIFEST_REL,
    JSON.stringify(manifestPayload, null, 2) + "\n",
    { contentType: "application/json" }
  );

  const zipBuf = await buildProjectZipBuffer(projectRoot, files);
  await uploadProjectFileContent(projectId, SNAPSHOT_ZIP_REL, zipBuf, {
    contentType: "application/zip",
  });

  const staleFiles = storageFilesBefore.filter(
    (relativePath) => !localSet.has(relativePath) && !PROTECTED_SNAPSHOT_OBJECTS.has(relativePath)
  );

  if (staleFiles.length > 0) {
    const staleStoragePaths = staleFiles.map((relativePath) => `${projectId}/${relativePath}`);
    await removeStoragePaths(staleStoragePaths);
  }

  await invalidateStaticPreviewIfSourcesChanged(projectId);

  console.log(
    `[storage] uploadFullProject ok files=${files.length} manifest+zip projectId=${projectId}`
  );

  return files;
}

/**
 * Sync project files to Storage in the background. Preview / E2B use the local
 * `sites/{projectId}` tree; this does not need to finish before the user can preview.
 */
export function scheduleUploadFullProject(projectId: string): void {
  void uploadFullProject(projectId).catch((err) => {
    console.error(`[storage] Background upload failed for ${projectId}:`, err);
  });
}

/** Recursively list all files in a storage prefix */
async function listAllFiles(prefix: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(currentPrefix: string) {
    const { data, error } = await getProjectFilesStorageClient().storage
      .from(BUCKET)
      .list(currentPrefix, { limit: 1000 });

    if (error || !data) return;

    for (const item of data) {
      const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name;
      if (item.id) {
        // It's a file
        result.push(fullPath);
      } else {
        // It's a folder — recurse
        await walk(fullPath);
      }
    }
  }

  await walk(prefix);
  return result;
}

const restoreInFlight = new Map<string, Promise<string[]>>();

async function projectPackageJsonExists(projectId: string): Promise<boolean> {
  try {
    await fs.access(path.join(getSiteRoot(projectId), "package.json"));
    return true;
  } catch {
    return false;
  }
}

async function localHomePageMissing(projectId: string): Promise<boolean> {
  try {
    await fs.access(path.join(getSiteRoot(projectId), "app", "page.tsx"));
    return false;
  } catch {
    return true;
  }
}

async function localHomePageIsPreparingStub(projectId: string): Promise<boolean> {
  try {
    const content = await fs.readFile(
      path.join(getSiteRoot(projectId), "app", "page.tsx"),
      "utf-8"
    );
    return isPreparingSiteHomePageStub(content);
  } catch {
    return false;
  }
}

async function remoteHomePageIsNonStub(projectId: string): Promise<boolean> {
  try {
    const { data, error } = await getProjectFilesStorageClient()
      .storage.from(BUCKET)
      .download(`${projectId}/app/page.tsx`);
    if (error || !data) return false;
    const text = Buffer.from(await data.arrayBuffer()).toString("utf-8");
    return text.trim().length > 0 && !isPreparingSiteHomePageStub(text);
  } catch {
    return false;
  }
}

/**
 * Never clobber a real generated home page with the init stub from a stale/partial
 * Storage snapshot (common right after generate, before uploadFullProject finishes).
 */
async function writeRestoredFileIfSafe(
  projectRoot: string,
  relativePath: string,
  buffer: Buffer
): Promise<boolean> {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized === "app/page.tsx" || normalized === "app/page.jsx") {
    const incoming = buffer.toString("utf-8");
    if (isPreparingSiteHomePageStub(incoming)) {
      try {
        const local = await fs.readFile(path.join(projectRoot, normalized), "utf-8");
        if (!isPreparingSiteHomePageStub(local)) {
          console.warn(
            `[storage] skip restore of stub ${normalized} over real local page`
          );
          return false;
        }
      } catch {
        /* local missing — allow writing stub */
      }
    }
  }
  const localPath = path.join(projectRoot, ...normalized.split("/"));
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);
  return true;
}

/**
 * True when local `sites/{id}` is out of date vs the last upload recorded in `projects.files_hash`.
 * Canonical generated sources live in Storage after `uploadFullProject`; preview/build must match that tree.
 */
async function isLocalProjectOutOfSyncWithStorage(
  db: SupabaseClient,
  projectId: string
): Promise<boolean> {
  const saved = parseProjectsFilesHash(await getSavedFingerprint(db, projectId));
  if (!saved.filesFingerprint) {
    return false;
  }
  if (!(await projectPackageJsonExists(projectId))) {
    return true;
  }
  const localFp = await computeProjectFingerprint(projectId);
  return localFp !== saved.filesFingerprint;
}

/**
 * Ensure `sites/{projectId}` matches what we can build.
 *
 * - No `package.json` → restore full tree from Storage (or template base).
 * - Missing `app/page.tsx` while Storage has a snapshot → restore (local wipe / failed re-init).
 * - Local home is still the "Preparing your site…" stub → restore (post-gen sources lost / never landed).
 * - With `db`: if disk fingerprint ≠ `projects.files_hash` → restore (API disk stale vs worker upload).
 *   Callers that write locally (e.g. modify agent) must invoke `syncLocalProjectFingerprint` first so
 *   newer on-disk edits are not mistaken for stale API copies.
 *
 * Without `db`, only the missing-package / missing-home-page / stub-home cases run (legacy callers).
 */
export async function ensureProjectSourcesOnDisk(
  projectId: string,
  options?: { db?: SupabaseClient }
): Promise<void> {
  const pkgExists = await projectPackageJsonExists(projectId);
  const homeMissing = pkgExists && (await localHomePageMissing(projectId));
  const homeIsStub = pkgExists && !homeMissing && (await localHomePageIsPreparingStub(projectId));
  const outOfSync =
    pkgExists && options?.db
      ? await isLocalProjectOutOfSyncWithStorage(options.db, projectId)
      : false;
  // Only chase Storage for a stub home when Storage actually has a real page.
  const stubFixableFromRemote =
    homeIsStub && (await remoteHomePageIsNonStub(projectId));

  const needsRestore = !pkgExists || homeMissing || outOfSync || stubFixableFromRemote;
  if (!needsRestore) {
    return;
  }

  if (homeMissing) {
    console.warn(
      `[storage] local app/page.tsx missing — restoring from Storage projectId=${projectId}`
    );
  } else if (stubFixableFromRemote) {
    console.warn(
      `[storage] local app/page.tsx is still the Preparing stub — restoring real page from Storage projectId=${projectId}`
    );
  }

  await restoreProjectFiles(projectId);
}

/** Download all files for a project from Storage to local sites/ directory */
export async function restoreProjectFiles(projectId: string): Promise<string[]> {
  const existing = restoreInFlight.get(projectId);
  if (existing) {
    return existing;
  }

  const promise = restoreProjectFilesInner(projectId);
  restoreInFlight.set(projectId, promise);
  try {
    return await promise;
  } finally {
    restoreInFlight.delete(projectId);
  }
}

async function restoreProjectFilesInner(projectId: string): Promise<string[]> {
  const totalStart = performance.now();
  const projectRoot = getSiteRoot(projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  const tplStart = performance.now();
  await restoreTemplateBaseFiles(projectId);
  const tplMs = Math.round(performance.now() - tplStart);

  /** 1 — Single GET snapshot + unzip (fewest Storage round trips). */
  const zipTryStart = performance.now();
  const zipResult = await restoreFromSnapshotZip(projectId, projectRoot);
  const zipTryMs = Math.round(performance.now() - zipTryStart);
  if (zipResult.ok === true && zipResult.files.length > 0) {
    const totalMs = Math.round(performance.now() - totalStart);
    console.log(
      `[preview restore] strategy=zip templateMissingMs=${tplMs} snapshotDownloadUnpackMs=${zipTryMs} ` +
        `files=${zipResult.files.length} TOTAL=${totalMs}ms projectId=${projectId}`
    );
    return zipResult.files;
  }
  console.log(
    `[preview restore] zipPathSkipped reason=${zipResult.ok === false ? zipResult.reason : "empty_entries"} ` +
      `zipTryMs=${zipTryMs} projectId=${projectId}`
  );

  /** 2 — One GET manifest + bounded-parallel downloads. */
  const manifestStart = performance.now();
  const manifest = await fetchSnapshotManifestParsed(projectId);
  const manifestFetchMs = Math.round(performance.now() - manifestStart);
  if (!manifest?.files?.length) {
    console.log(
      `[preview restore] manifestSkipped fetchMs=${manifestFetchMs} (missing invalid_v1 or empty_files) projectId=${projectId}`
    );
  }
  if (manifest?.files?.length) {
    const dlStart = performance.now();
    const restored = await restoreFromManifestBatchedDownloads(projectId, projectRoot, manifest.files);
    const dlMs = Math.round(performance.now() - dlStart);
    const totalMs = Math.round(performance.now() - totalStart);
    console.log(
      `[preview restore] strategy=manifestBatched manifestFetchMs=${manifestFetchMs} ` +
        `templateMissingMs=${tplMs} manifestFiles=${manifest.files.length} downloaded=${restored.length} ` +
        `downloadWriteMs=${dlMs} zipFallbackMs=${zipTryMs} TOTAL=${totalMs}ms projectId=${projectId}`
    );
    return restored;
  }

  /** 3 — Legacy: recursive list + parallel GET (old projects without manifest/zip). */
  const listStart = performance.now();
  const allPaths = await listAllFiles(projectId);
  const listMs = Math.round(performance.now() - listStart);
  console.log(
    `[preview restore] strategy=recursiveList templateMissingMs=${tplMs} listRemoteMs=${listMs} ` +
      `remoteObjects=${allPaths.length} projectId=${projectId}`
  );

  if (allPaths.length === 0) {
    console.log(
      `[preview restore] TOTAL=${Math.round(performance.now() - totalStart)}ms (no remote files) projectId=${projectId}`
    );
    return [];
  }

  const codePathsOnly = allPaths.filter((storagePath) => {
    const relativePath = storagePath.slice(projectId.length + 1);
    return !relativePath.startsWith(".open-ox/");
  });

  const dlStart = performance.now();
  const restored: string[] = [];

  await Promise.all(
    codePathsOnly.map(async (storagePath) => {
      const { data, error } = await getProjectFilesStorageClient().storage.from(BUCKET).download(storagePath);

      if (error || !data) return;

      const relativePath = storagePath.slice(projectId.length + 1);
      const buffer = Buffer.from(await data.arrayBuffer());
      if (await writeRestoredFileIfSafe(projectRoot, relativePath, buffer)) {
        restored.push(relativePath);
      }
    })
  );

  const dlMs = Math.round(performance.now() - dlStart);
  const totalMs = Math.round(performance.now() - totalStart);
  console.log(
    `[preview restore] downloadWriteMs=${dlMs} wrote=${restored.length} TOTAL=${totalMs}ms projectId=${projectId}`
  );

  return restored;
}

/** Delete all stored files for a project */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  const allPaths = await listAllFiles(projectId);
  if (allPaths.length === 0) return;
  await removeStoragePaths(allPaths);
}

/** List all files stored for a project (relative paths) */
export async function listProjectFiles(projectId: string): Promise<string[]> {
  const allPaths = await listAllFiles(projectId);
  return allPaths.map((p) => p.slice(projectId.length + 1));
}

async function removeStoragePaths(storagePaths: string[]): Promise<void> {
  for (let i = 0; i < storagePaths.length; i += 1000) {
    const batch = storagePaths.slice(i, i + 1000);
    const { error } = await getProjectFilesStorageClient().storage.from(BUCKET).remove(batch);
    if (error) {
      throw new Error(`[storage] Failed to delete ${batch.length} file(s): ${error.message}`);
    }
  }
}

async function restoreTemplateBaseFiles(projectId: string): Promise<void> {
  const templateRoot = path.join(WORKSPACE_ROOT, "sites", "template");
  const projectRoot = getSiteRoot(projectId);
  await copyTemplateMissing(templateRoot, projectRoot, templateRoot);
}

async function copyTemplateMissing(srcDir: string, destDir: string, templateRoot: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = path.relative(templateRoot, srcPath).split(path.sep).join("/");
    const excluded = Array.from(TEMPLATE_RESTORE_EXCLUDE).some(
      (rule) => relPath === rule || relPath.startsWith(`${rule}/`)
    );
    if (excluded) continue;

    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyTemplateMissing(srcPath, destPath, templateRoot);
      continue;
    }
    if (!entry.isFile()) continue;

    const exists = await fs
      .access(destPath)
      .then(() => true)
      .catch(() => false);
    if (exists) continue;
    await fs.copyFile(srcPath, destPath);
  }
}
