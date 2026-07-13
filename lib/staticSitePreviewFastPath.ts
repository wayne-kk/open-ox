import { parseProjectsFilesHash } from "@/lib/previewFingerprintDb";

export type InstantStaticPreviewInput = {
  force?: boolean;
  filesHash: string | null;
  staticPreviewSyncedAt: string | null;
  currentOriginFingerprint: string;
  /**
   * When set, must equal the files half of `filesHash`. Prevents serving a stale
   * Storage export after local sources moved on (e.g. mid-gen stub → real page).
   */
  currentFilesFingerprint?: string | null;
};

/** DB-only gate for skipping restore + rebuild when static export is already published. */
export function canUseInstantStaticPreview(input: InstantStaticPreviewInput): boolean {
  if (input.force === true) return false;
  if (!input.staticPreviewSyncedAt) return false;

  const saved = parseProjectsFilesHash(input.filesHash);
  if (!saved.filesFingerprint) return false;
  if (saved.storageOriginFingerprint !== input.currentOriginFingerprint) return false;

  if (
    input.currentFilesFingerprint != null &&
    input.currentFilesFingerprint !== "" &&
    input.currentFilesFingerprint !== saved.filesFingerprint
  ) {
    return false;
  }

  return true;
}
