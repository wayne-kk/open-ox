import type { SupabaseClient } from "@supabase/supabase-js";

import { scheduleCaptureProjectCover } from "@/lib/projectCoverCapture";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import { shouldPublishStaticSitePreview } from "@/lib/previewMode";
import { uploadFullProject } from "@/lib/storage";
import { syncStaticSitePreview } from "@/lib/staticSitePreview";

/**
 * Sync fingerprint + static preview (force). Does not upload sources or capture cover.
 * Used when a caller must wait for Storage preview before screenshot (e.g. Feishu).
 */
export async function awaitPostModifyStaticPreviewSync(
  db: SupabaseClient,
  projectId: string
): Promise<void> {
  try {
    await syncLocalProjectFingerprint(db, projectId);
  } catch (fpErr) {
    console.warn(
      `[preview pipeline] syncLocalProjectFingerprint failed ${projectId}:`,
      fpErr instanceof Error ? fpErr.message : fpErr
    );
  }
  if (shouldPublishStaticSitePreview()) {
    await syncStaticSitePreview(db, projectId, { force: true });
  }
}

/**
 * After generation/modify: publish static preview from local disk first (user-visible),
 * then upload source snapshot for cross-device restore, then cover capture.
 *
 * Uses force + fingerprint sync so a mid-generation preview (stub `app/page.tsx`) cannot
 * coalesce into this publish via `inFlight` and leave Storage on the default page.
 */
export function schedulePostGenerationPreviewPipeline(
  db: SupabaseClient,
  projectId: string
): void {
  void (async () => {
    try {
      await awaitPostModifyStaticPreviewSync(db, projectId);
      await uploadFullProject(projectId);
      scheduleCaptureProjectCover(projectId);
    } catch (err) {
      console.error(`[preview pipeline] post-generation failed ${projectId}:`, err);
    }
  })();
}

/** Same ordering as generation, but only runs static rebuild when modify build passed. */
export function schedulePostModifyPreviewPipeline(
  db: SupabaseClient,
  projectId: string,
  options: { buildPassed: boolean }
): void {
  if (!options.buildPassed) {
    void uploadFullProject(projectId).catch((err) => {
      console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
    });
    return;
  }

  schedulePostGenerationPreviewPipeline(db, projectId);
}

/**
 * Await static preview sync, then fire-and-forget source upload + cover (no second sync race).
 */
export async function runPostModifyPreviewPipelineBeforeCapture(
  db: SupabaseClient,
  projectId: string,
  options: { buildPassed: boolean }
): Promise<void> {
  if (!options.buildPassed) {
    void uploadFullProject(projectId).catch((err) => {
      console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
    });
    return;
  }
  await awaitPostModifyStaticPreviewSync(db, projectId);
  void uploadFullProject(projectId).catch((err) => {
    console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
  });
  scheduleCaptureProjectCover(projectId);
}
