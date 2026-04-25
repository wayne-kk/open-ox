import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSavedFingerprint(
  db: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data } = await db
    .from("projects")
    .select("files_hash")
    .eq("id", projectId)
    .single();
  return (data as { files_hash: string | null } | null)?.files_hash ?? null;
}

export async function saveFingerprint(
  db: SupabaseClient,
  projectId: string,
  hash: string
): Promise<void> {
  await db
    .from("projects")
    .update({ files_hash: hash, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}
