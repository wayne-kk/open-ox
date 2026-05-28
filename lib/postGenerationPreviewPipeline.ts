import type { SupabaseClient } from "@supabase/supabase-js";

import { scheduleCaptureProjectCover } from "@/lib/projectCoverCapture";
import { isPreviewStorage } from "@/lib/previewMode";
import { uploadFullProject } from "@/lib/storage";
import { syncStaticSitePreview } from "@/lib/staticSitePreview";

/**
 * After generation/modify: upload snapshot (manifest + zip) first, then static build, then cover capture.
 * Serializes work that previously raced and caused slow recursive Storage restores on deploy.
 */
export function schedulePostGenerationPreviewPipeline(
  db: SupabaseClient,
  projectId: string
): void {
  void (async () => {
    try {
      await uploadFullProject(projectId);
      if (isPreviewStorage()) {
        await syncStaticSitePreview(db, projectId);
      }
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
