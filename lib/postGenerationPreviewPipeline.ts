import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { scheduleCaptureProjectCover } from "@/lib/projectCoverCapture";
import {
  getProject,
  getSiteRoot,
  hasUsableStaticPreview,
} from "@/lib/projectManager";
import { isPreparingSiteHomePageStub } from "@/lib/preparingSiteHomePageStub";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import { shouldPublishStaticSitePreview } from "@/lib/previewMode";
import {
  isPreparingStubPreviewSkip,
  shouldScheduleAutoCoverAfterPipeline,
  STATIC_PREVIEW_STUB_RETRY_ATTEMPTS,
  STATIC_PREVIEW_STUB_RETRY_DELAY_MS,
} from "@/lib/postGenerationPreviewPipelinePolicy";
import { uploadFullProject } from "@/lib/storage";
import { syncStaticSitePreview } from "@/lib/staticSitePreview";
import {
  captureProjectVersion,
  markProjectVersionCapturePending,
  type ProjectVersionSourceKind,
} from "@/lib/projectVersions";

async function captureVersionBestEffort(
  projectId: string,
  sourceKind: ProjectVersionSourceKind,
  summary: string,
  verificationStatus: "passed" | "failed" | "unknown" = "passed"
): Promise<void> {
  try {
    await captureProjectVersion(projectId, {
      sourceKind,
      summary,
      verificationStatus,
    });
  } catch (error) {
    console.error(`[projectVersions] capture failed projectId=${projectId}:`, error);
  }
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStaticPreviewReady(
  db: SupabaseClient,
  projectId: string
): Promise<boolean> {
  try {
    const project = await getProject(db, projectId);
    return project ? hasUsableStaticPreview(project) : false;
  } catch {
    return false;
  }
}

/**
 * Sync fingerprint + static preview (force). Does not upload sources or capture cover.
 * Retries Preparing-stub soft-skips like Studio auto-preview.
 * Used when a caller must wait for Storage preview before screenshot (e.g. Feishu).
 */
export async function awaitPostModifyStaticPreviewSync(
  db: SupabaseClient,
  projectId: string
): Promise<{ staticPreviewReady: boolean }> {
  // Do NOT stamp files_hash here — syncStaticSitePreview(force) decides whether
  // local fingerprint is safe to trust (never stamps while home is still the
  // Preparing stub). Premature stamp was racing first auto-preview and blocking restore.
  if (!shouldPublishStaticSitePreview()) {
    try {
      await syncLocalProjectFingerprint(db, projectId);
    } catch (fpErr) {
      console.warn(
        `[preview pipeline] syncLocalProjectFingerprint failed ${projectId}:`,
        fpErr instanceof Error ? fpErr.message : fpErr
      );
    }
    return { staticPreviewReady: false };
  }

  for (let attempt = 0; attempt < STATIC_PREVIEW_STUB_RETRY_ATTEMPTS; attempt += 1) {
    const result = await syncStaticSitePreview(db, projectId, { force: true });
    if (!isPreparingStubPreviewSkip(result)) {
      break;
    }
    if (attempt < STATIC_PREVIEW_STUB_RETRY_ATTEMPTS - 1) {
      console.warn(
        `[preview pipeline] static preview preparing_stub — retry ` +
          `${attempt + 1}/${STATIC_PREVIEW_STUB_RETRY_ATTEMPTS} projectId=${projectId}`
      );
      await sleep(STATIC_PREVIEW_STUB_RETRY_DELAY_MS);
      continue;
    }
    console.warn(
      `[preview pipeline] static preview still preparing_stub after ` +
        `${STATIC_PREVIEW_STUB_RETRY_ATTEMPTS} attempts projectId=${projectId}`
    );
  }

  const staticPreviewReady = await readStaticPreviewReady(db, projectId);
  return { staticPreviewReady };
}

async function maybeScheduleCaptureProjectCover(
  db: SupabaseClient,
  projectId: string
): Promise<void> {
  const publishesStaticPreview = shouldPublishStaticSitePreview();
  // Re-check at schedule time: Studio may finish publishing while version upload runs.
  const staticPreviewReady = publishesStaticPreview
    ? await readStaticPreviewReady(db, projectId)
    : false;
  if (
    !shouldScheduleAutoCoverAfterPipeline({
      publishesStaticPreview,
      staticPreviewReady,
    })
  ) {
    console.warn(
      `[preview pipeline] skip auto cover — static preview not ready projectId=${projectId}`
    );
    return;
  }
  scheduleCaptureProjectCover(projectId);
}

/**
 * After generation/modify: publish static preview from local disk first (user-visible),
 * then upload source snapshot for cross-device restore, then cover capture.
 *
 * Uses force + fingerprint sync so a mid-generation preview (stub `app/page.tsx`) cannot
 * coalesce into this publish via `inFlight` and leave Storage on the default page.
 * Cover runs only after Storage preview is actually marked synced (when publish is on).
 */
export function schedulePostGenerationPreviewPipeline(
  db: SupabaseClient,
  projectId: string
): void {
  void (async () => {
    try {
      await markProjectVersionCapturePending(projectId);
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
      await captureVersionBestEffort(projectId, "generate", "初始生成");
      await maybeScheduleCaptureProjectCover(db, projectId);
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
    void (async () => {
      try {
        await markProjectVersionCapturePending(projectId);
        await uploadFullProject(projectId);
        await captureVersionBestEffort(projectId, "modify", "项目修改", "failed");
      } catch (err) {
        console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
      }
    })();
    return;
  }
  void (async () => {
    try {
      await markProjectVersionCapturePending(projectId);
      await assertHomePageNotPreparingStub(projectId);
      await awaitPostModifyStaticPreviewSync(db, projectId);
      await uploadFullProject(projectId);
      await captureVersionBestEffort(projectId, "modify", "项目修改");
      await maybeScheduleCaptureProjectCover(db, projectId);
    } catch (err) {
      console.error(`[preview pipeline] post-modify failed ${projectId}:`, err);
    }
  })();
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
    void (async () => {
      try {
        await markProjectVersionCapturePending(projectId);
        await uploadFullProject(projectId);
        await captureVersionBestEffort(projectId, "modify", "项目修改", "failed");
      } catch (err) {
        console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
      }
    })();
    return;
  }
  await markProjectVersionCapturePending(projectId);
  await awaitPostModifyStaticPreviewSync(db, projectId);
  void uploadFullProject(projectId)
    .then(() => captureVersionBestEffort(projectId, "modify", "项目修改"))
    .catch((err) => {
      console.error(`[preview pipeline] modify upload failed ${projectId}:`, err);
    });
  await maybeScheduleCaptureProjectCover(db, projectId);
}
