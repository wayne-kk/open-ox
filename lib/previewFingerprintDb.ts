import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `projects.files_hash` may store:
 * - **E2B / local preview**: `<filesFingerprint>` (16 hex from `computeProjectFingerprint`)
 * - **Storage static preview**: `<filesFingerprint>:<originFingerprint>` where `originFingerprint` hashes
 *   `NEXT_PUBLIC_SITE_URL` (preview build `assetPrefix` + iframe URL depend on it)
 */
export function parseProjectsFilesHash(saved: string | null): {
  filesFingerprint: string | null;
  storageOriginFingerprint: string | null;
} {
  if (saved == null || saved === "") {
    return { filesFingerprint: null, storageOriginFingerprint: null };
  }
  const i = saved.indexOf(":");
  if (i === -1) {
    return { filesFingerprint: saved, storageOriginFingerprint: null };
  }
  return {
    filesFingerprint: saved.slice(0, i),
    storageOriginFingerprint: saved.slice(i + 1),
  };
}

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
