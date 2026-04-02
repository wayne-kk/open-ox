/**
 * Project file storage — Supabase Storage bucket: "project-files"
 *
 * Layout:
 *   project-files/{projectId}/{relativePath}
 */

import fs from "fs/promises";
import path from "path";
import { supabase } from "./supabase";
import { getSiteRoot } from "./projectManager";

const BUCKET = "project-files";

/** Upload a single local file to Supabase Storage */
export async function uploadProjectFile(
  projectId: string,
  relativeFilePath: string
): Promise<void> {
  const localPath = path.join(getSiteRoot(projectId), relativeFilePath);
  const content = await fs.readFile(localPath);
  const storagePath = `${projectId}/${relativeFilePath}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, content, { upsert: true });

  if (error) {
    throw new Error(`[storage] Failed to upload ${storagePath}: ${error.message}`);
  }
}

/** Upload all generated files for a project */
export async function uploadGeneratedFiles(
  projectId: string,
  generatedFiles: string[]
): Promise<void> {
  await Promise.allSettled(
    generatedFiles.map((f) => uploadProjectFile(projectId, f))
  );
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

  // Supabase remove accepts max 1000 paths at a time
  for (let i = 0; i < allPaths.length; i += 1000) {
    const batch = allPaths.slice(i, i + 1000);
    await supabase.storage.from(BUCKET).remove(batch);
  }
}

/** List all files stored for a project (relative paths) */
export async function listProjectFiles(projectId: string): Promise<string[]> {
  const allPaths = await listAllFiles(projectId);
  return allPaths.map((p) => p.slice(projectId.length + 1));
}
