import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { scheduleCaptureProjectCover } from "@/lib/projectCoverCapture";
import { getSiteRoot } from "@/lib/projectManager";
import { isPreparingSiteHomePageStub } from "@/lib/preparingSiteHomePageStub";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import { shouldPublishStaticSitePreview } from "@/lib/previewMode";
import { uploadFullProject } from "@/lib/storage";
import { syncStaticSitePreview } from "@/lib/staticSitePreview";

async function assertHomePageNotPreparingStub(projectId: string): Promise<void> {
  const pagePath = path.join(getSiteRoot(projectId), "app", "page.tsx");
  let content = "";
  try {
    content = await fs.readFile(pagePath, "utf-8");
  } catch {
    throw new Error(
      `[preview pipeline] app/page.tsx missing after generation projectId=${projectId}`
    );
  }
  if (isPreparingSiteHomePageStub(content)) {
    throw new Error(
      `[preview pipeline] app/page.tsx is still the Preparing stub after generation ` +
        `projectId=${projectId} — refusing to publish static preview`
    );
  }
}

/**
 * Sync fingerprint + static preview (force). Does not upload sources or capture cover.
 * Used when a caller must wait for Storage preview before screenshot (e.g. Feishu).
 */
export async function awaitPostModifyStaticPreviewSync(
  db: SupabaseClient,
  projectId: string
): Promise<void> {
  // Do NOT stamp files_hash here — syncStaticSitePreview(force) decides whether
  // local fingerprint is safe to trust (never stamps while home is still the
  // Preparing stub). Premature stamp was racing first auto-preview and blocking restore.
  if (shouldPublishStaticSitePreview()) {
    await syncStaticSitePreview(db, projectId, { force: true });
  } else {
    try {
      await syncLocalProjectFingerprint(db, projectId);
    } catch (fpErr) {
      console.warn(
        `[preview pipeline] syncLocalProjectFingerprint failed ${projectId}:`,
        fpErr instanceof Error ? fpErr.message : fpErr
      );
    }
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
      await assertHomePageNotPreparingStub(projectId);
      // Publish static preview from local disk first (coalesces with Studio Rebuild),
      // then upload the full source snapshot for cross-device restore.
      await awaitPostModifyStaticPreviewSync(db, projectId);
      try {
        await uploadFullProject(projectId);
      } catch (uploadErr) {
        console.error(
          `[preview pipeline] uploadFullProject failed ${projectId}:`,
          uploadErr
        );
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
