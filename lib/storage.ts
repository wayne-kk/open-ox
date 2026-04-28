/**
 * Project file storage — Supabase Storage bucket: "project-files"
 *
 * Layout:
 *   project-files/{projectId}/{relativePath}
 */

import fs from "fs/promises";
import path from "path";
import { supabase } from "./supabase";
import { getSiteRoot, WORKSPACE_ROOT } from "./projectManager";

const BUCKET = "project-files";
const STORAGE_UPLOAD_EXCLUDE = new Set(["node_modules", ".next", ".git", "out"]);
const STORAGE_UPLOAD_EXCLUDE_PREFIXES = ["components/ui/"];
const STORAGE_UPLOAD_CONCURRENCY = 20;
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
  content: Buffer | string
): Promise<void> {
  const storagePath = `${projectId}/${relativeFilePath}`;
  const body = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  let lastErrorMessage = "";

  for (let attempt = 0; attempt <= STORAGE_UPLOAD_MAX_RETRIES; attempt += 1) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, body, { upsert: true });

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

/** Upload the complete local project tree so cross-device restore is consistent */
export async function uploadFullProject(projectId: string): Promise<string[]> {
  const projectRoot = getSiteRoot(projectId);
  const files = await collectProjectFiles(projectRoot, projectRoot);
  files.sort();
  const localSet = new Set(files);

  // Snapshot remote file list once. Recursive listing is expensive (one Storage `list`
  // per directory); doing it again after upload doubled latency on large prefixes.
  const storageFilesBefore = await listProjectFiles(projectId);

  // Upload files with bounded concurrency to avoid storage rate-limit spikes.
  await runInBatches(files, STORAGE_UPLOAD_CONCURRENCY, async (relativePath) => {
    await uploadProjectFile(projectId, relativePath);
  });

  // Remove stale files so storage mirrors local project state across devices.
  const staleFiles = storageFilesBefore.filter((relativePath) => !localSet.has(relativePath));
  if (staleFiles.length > 0) {
    const staleStoragePaths = staleFiles.map((relativePath) => `${projectId}/${relativePath}`);
    await removeStoragePaths(staleStoragePaths);
  }

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
    const { data, error } = await supabase.storage
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

/** Download all files for a project from Storage to local sites/ directory */
export async function restoreProjectFiles(projectId: string): Promise<string[]> {
  const projectRoot = getSiteRoot(projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  await restoreTemplateBaseFiles(projectId);

  const allPaths = await listAllFiles(projectId);
  if (allPaths.length === 0) return [];

  const restored: string[] = [];

  await Promise.all(
    allPaths.map(async (storagePath) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

      if (error || !data) return;

      // storagePath = "projectId/components/sections/Foo.tsx"
      // relativePath = "components/sections/Foo.tsx"
      const relativePath = storagePath.slice(projectId.length + 1);
      const localPath = path.join(getSiteRoot(projectId), relativePath);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      const buffer = Buffer.from(await data.arrayBuffer());
      await fs.writeFile(localPath, buffer);
      restored.push(relativePath);
    })
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
  // Supabase remove accepts max 1000 paths at a time
  for (let i = 0; i < storagePaths.length; i += 1000) {
    const batch = storagePaths.slice(i, i + 1000);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
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
