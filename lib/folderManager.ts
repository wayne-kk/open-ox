import fs from "fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteRoot } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { stopDevServer } from "@/lib/devServerManager";

export interface ProjectFolderRow {
  id: string;
  name: string;
  createdAt: string;
}

export async function listFolders(db: SupabaseClient, userId: string): Promise<ProjectFolderRow[]> {
  const { data, error } = await db
    .from("project_folders")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[folderManager] listFolders:", error.message);
    return [];
  }
  return (data as { id: string; name: string; created_at: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

export async function createFolder(
  db: SupabaseClient,
  userId: string,
  name: string
): Promise<ProjectFolderRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const { data, error } = await db
    .from("project_folders")
    .insert({ user_id: userId, name: trimmed })
    .select("id,name,created_at")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create folder");
  }
  const row = data as { id: string; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/**
 * Deletes local artifacts and storage for each project, then deletes the folder row
 * (DB cascades delete project rows).
 */
export async function deleteFolderAndProjects(
  db: SupabaseClient,
  userId: string,
  folderId: string
): Promise<{ deletedProjectIds: string[] }> {
  const { data: folder, error: folderErr } = await db
    .from("project_folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (folderErr || !folder) {
    throw new Error("Folder not found");
  }

  const { data: rows, error: listErr } = await db
    .from("projects")
    .select("id")
    .eq("folder_id", folderId);
  if (listErr) throw new Error(listErr.message);

  const deletedProjectIds = (rows ?? []).map((r: { id: string }) => r.id);

  for (const projectId of deletedProjectIds) {
    await stopDevServer(db, projectId);
    await deleteProjectFiles(projectId).catch((err) =>
      console.error(`[deleteFolder] Storage cleanup failed for ${projectId}:`, err)
    );
    await fs.rm(getSiteRoot(projectId), { recursive: true, force: true }).catch((err) =>
      console.error(`[deleteFolder] Local rm failed for ${projectId}:`, err)
    );
  }

  const { error: delErr } = await db.from("project_folders").delete().eq("id", folderId).eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);

  return { deletedProjectIds };
}
