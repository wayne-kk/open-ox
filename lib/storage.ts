/**
 * Project file storage — Supabase Storage bucket: "project-files"
 *
 * Layout:
 *   project-files/{projectId}/{relativePath}
 *
 * Used to persist generated site files so they survive server restarts
 * and can be restored to the local sites/ directory on demand.
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

/** Download all files for a project from Storage to local sites/ directory */
export async function restoreProjectFiles(projectId: string): Promise<void> {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(projectId, { limit: 1000 });

  if (error) throw new Error(`[storage] Failed to list files: ${error.message}`);
  if (!files || files.length === 0) return;

  await Promise.all(
    files.map(async (file) => {
      const storagePath = `${projectId}/${file.name}`;
      const { data, error: dlError } = await supabase.storage
        .from(BUCKET)
        .download(storagePath);

      if (dlError || !data) return;

      const localPath = path.join(getSiteRoot(projectId), file.name);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      const buffer = Buffer.from(await data.arrayBuffer());
      await fs.writeFile(localPath, buffer);
    })
  );
}

/** Delete all stored files for a project */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(projectId, { limit: 1000 });

  if (error || !files || files.length === 0) return;

  const paths = files.map((f) => `${projectId}/${f.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}
