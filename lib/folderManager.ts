import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function getFolder(
  db: SupabaseClient,
  userId: string,
  folderId: string
): Promise<ProjectFolderRow | null> {
  const { data, error } = await db
    .from("project_folders")
    .select("id,name,created_at")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function countProjectsInFolder(
  db: SupabaseClient,
  userId: string,
  folderId: string
): Promise<number> {
  const { count, error } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("folder_id", folderId);
  if (error) throw new Error(error.message);
  return count ?? 0;
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

export async function renameFolder(
  db: SupabaseClient,
  userId: string,
  folderId: string,
  name: string
): Promise<ProjectFolderRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const { data, error } = await db
    .from("project_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .eq("user_id", userId)
    .select("id,name,created_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Folder not found");
  const row = data as { id: string; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/**
 * Dissolves a folder: moves projects to root (`folder_id` null), then deletes the folder row.
 * Does not delete projects.
 */
export async function dissolveFolder(
  db: SupabaseClient,
  userId: string,
  folderId: string
): Promise<{ movedProjectCount: number }> {
  const folder = await getFolder(db, userId, folderId);
  if (!folder) throw new Error("Folder not found");

  const { data: rows, error: listErr } = await db
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("folder_id", folderId);
  if (listErr) throw new Error(listErr.message);

  const projectIds = (rows ?? []).map((r: { id: string }) => r.id);

  if (projectIds.length > 0) {
    const { error: moveErr } = await db
      .from("projects")
      .update({ folder_id: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("folder_id", folderId);
    if (moveErr) throw new Error(moveErr.message);
  }

  const { error: delErr } = await db
    .from("project_folders")
    .delete()
    .eq("id", folderId)
    .eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);

  return { movedProjectCount: projectIds.length };
}
