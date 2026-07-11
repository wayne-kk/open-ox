import type { SupabaseClient } from "@supabase/supabase-js";
import { computeProjectFingerprint } from "./previewShared";

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

/**
 * Build the `projects.files_hash` value for the current on-disk tree, preserving
 * the static-preview origin suffix when already stored.
 */
export function formatLocalProjectFingerprintHash(
  localFingerprint: string,
  savedHash: string | null
): string {
  const saved = parseProjectsFilesHash(savedHash);
  return saved.storageOriginFingerprint != null
    ? `${localFingerprint}:${saved.storageOriginFingerprint}`
    : localFingerprint;
}

/**
 * After modify (or any local edit), mark disk as canonical so restore paths do
 * not treat newer local files as stale vs Storage.
 *
 * Also marks Storage static preview **dirty**: clears `static_preview_synced_at` and
 * drops the origin suffix from `files_hash` until `syncStaticSitePreview` republishes.
 * Otherwise fingerprint short-circuit / instant preview would serve a stale export.
 */
export async function syncLocalProjectFingerprint(
  db: SupabaseClient,
  projectId: string
): Promise<string> {
  const localFp = await computeProjectFingerprint(projectId);
  const prev = await getSavedFingerprint(db, projectId);
  const saved = parseProjectsFilesHash(prev);

  // Unchanged sources already in published aggregate form — leave alone.
  if (saved.filesFingerprint === localFp && saved.storageOriginFingerprint != null) {
    return prev ?? localFp;
  }

  const { error } = await db
    .from("projects")
    .update({
      files_hash: localFp,
      static_preview_synced_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    // Fallback: at least persist fingerprint so restore does not clobber local edits.
    await saveFingerprint(db, projectId, localFp);
  }

  return localFp;
}
