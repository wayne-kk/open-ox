/**
 * Background job: desktop first-viewport JPEG (1480×960) → cinematic polish → Storage → DB.
 * Server-only. Requires SUPABASE_SERVICE_ROLE_KEY and the Screenshot Service (Playwright).
 */

import {
  isFreshCoverPending,
  type CoverScheduleResult,
} from "@/lib/coverCaptureOrchestration";
import {
  getExistingLocalPreviewUrl as getExistingLocalNextPreviewUrl,
  startLocalDevServer,
} from "@/lib/localDevServerManager";
import { previewCaptureExtraHeaders } from "@/lib/previewCaptureAuth";
import { getPreviewBackend, storagePreviewDepsPresent } from "@/lib/previewMode";
import { previewUrlAllowedForScreenshot } from "@/lib/previewScreenshotUrl";
import { captureCoverViewportJpeg } from "@/lib/screenshot/client";
import {
  getProject,
  hasUsableStaticPreview,
  updateProjectCoverState,
} from "@/lib/projectManager";
import {
  getStaticPreviewUrl,
  getStoragePreviewPublicObjectUrl,
  syncStaticSitePreview,
} from "@/lib/staticSitePreview";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadCoverScreenshot } from "@/lib/storage";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/** Relative key under bucket prefix `{projectId}/` */
export const COVER_STORAGE_RELATIVE_PATH = ".open-ox-cover/cover.jpg";

/** End-to-end budget so a hung restore/next start cannot hold the in-process lock forever. */
const COVER_CAPTURE_JOB_TIMEOUT_MS = 150_000;

/**
 * Fresh DB `pending` from another live worker — refuse briefly.
 * After this, reclaim (HMR / crashed worker leaves pending with no process lock).
 */
const COVER_CAPTURE_PEER_PENDING_GRACE_MS = 20_000;

const inFlightCover = new Set<string>();

function coverCaptureDisabledEnv(): boolean {
  return process.env.OPEN_OX_COVER_CAPTURE?.trim() === "0";
}

function truncateErr(msg: string, max = 1900): string {
  const s = msg.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

async function withJobTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** True when site-previews already has index.html (no rebuild). */
async function probePublishedStaticPreview(projectId: string): Promise<boolean> {
  try {
    const url = getStoragePreviewPublicObjectUrl(projectId, "index.html");
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve a reachable preview URL for cover capture.
 * Order: running local next → already-published static → (non-local) static sync → start local next.
 * Never runs a full static rebuild when `OPEN_OX_PREVIEW_BACKEND=local`.
 */
async function resolveCoverCapturePreviewUrl(
  db: SupabaseClient,
  projectId: string
): Promise<{ url: string; extraHeaders: Record<string, string> | null }> {
  const captureHeaders = previewCaptureExtraHeaders();
  const preferLocal = getPreviewBackend() === "local";
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);

  const reused = await getExistingLocalNextPreviewUrl(db, projectId);
  if (reused) {
    console.log(
      `[projectCoverCapture] preview=local-reuse ${elapsed()}ms projectId=${projectId}`
    );
    return { url: reused.url, extraHeaders: null };
  }

  if (captureHeaders && storagePreviewDepsPresent()) {
    const project = await getProject(db, projectId);
    const markedSynced = project ? hasUsableStaticPreview(project) : false;
    const published =
      markedSynced || (await probePublishedStaticPreview(projectId));
    if (published) {
      console.log(
        `[projectCoverCapture] preview=static-published ${elapsed()}ms projectId=${projectId}`
      );
      return { url: getStaticPreviewUrl(projectId), extraHeaders: captureHeaders };
    }
  }

  if (!preferLocal && captureHeaders && storagePreviewDepsPresent()) {
    try {
      console.log(`[projectCoverCapture] preview=static-sync begin projectId=${projectId}`);
      await syncStaticSitePreview(db, projectId);
      console.log(
        `[projectCoverCapture] preview=static-sync ok ${elapsed()}ms projectId=${projectId}`
      );
      return { url: getStaticPreviewUrl(projectId), extraHeaders: captureHeaders };
    } catch (err) {
      console.warn(
        `[projectCoverCapture] static preview unavailable, falling back to local next ${projectId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`[projectCoverCapture] preview=local-start begin projectId=${projectId}`);
  const { url } = await startLocalDevServer(db, projectId);
  console.log(
    `[projectCoverCapture] preview=local-start ok ${elapsed()}ms projectId=${projectId}`
  );
  return { url, extraHeaders: null };
}

async function screenshotHomeViewportViaService(
  previewEntryUrl: string,
  extraHeaders: Record<string, string> | null
): Promise<Buffer> {
  previewUrlAllowedForScreenshot(previewEntryUrl);
  if (previewEntryUrl.includes("/site-previews/") && !extraHeaders) {
    throw new Error(
      "Cover capture refused auth-gated /site-previews URL without OPEN_OX_PREVIEW_CAPTURE_SECRET"
    );
  }
  return captureCoverViewportJpeg({
    url: previewEntryUrl,
    extraHeaders,
    polish: true,
  });
}

/**
 * One-shot homepage viewport JPEG for Feishu (and similar). Fail-open → null.
 * Does not write cover Storage / DB state.
 */
export async function captureProjectHomepageJpeg(
  db: SupabaseClient,
  projectId: string
): Promise<Buffer | null> {
  if (coverCaptureDisabledEnv()) return null;
  try {
    const { url, extraHeaders } = await resolveCoverCapturePreviewUrl(db, projectId);
    return await screenshotHomeViewportViaService(url, extraHeaders);
  } catch (err) {
    console.warn(
      `[projectCoverCapture] homepage jpeg for ${projectId} failed:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function readCoverBaseline(
  db: SupabaseClient,
  projectId: string
): Promise<{ status: string | null; updatedAt: string | null }> {
  const project = await getProject(db, projectId);
  return {
    status: project?.coverImageStatus ?? null,
    updatedAt: project?.coverImageUpdatedAt ?? null,
  };
}

type AcquireOutcome =
  | { ok: true; baselineUpdatedAt: string | null; db: SupabaseClient }
  | { ok: false; reason: "in_flight" | "no_service_role"; baselineUpdatedAt: string | null };

/**
 * Reserve process-local slot first (sync). DB `pending` only blocks briefly (peer grace);
 * after that we reclaim — Next HMR / crashed workers otherwise leave cover stuck silent.
 */
async function tryAcquireCoverCapture(projectId: string): Promise<AcquireOutcome> {
  let db: SupabaseClient;
  try {
    db = createSupabaseServiceRoleClient();
  } catch {
    return { ok: false, reason: "no_service_role", baselineUpdatedAt: null };
  }

  if (inFlightCover.has(projectId)) {
    const baseline = await readCoverBaseline(db, projectId);
    return { ok: false, reason: "in_flight", baselineUpdatedAt: baseline.updatedAt };
  }
  inFlightCover.add(projectId);

  try {
    const baseline = await readCoverBaseline(db, projectId);
    if (isFreshCoverPending(baseline.status, baseline.updatedAt, Date.now())) {
      const updatedMs = baseline.updatedAt ? Date.parse(baseline.updatedAt) : Number.NaN;
      const ageMs = Number.isFinite(updatedMs) ? Date.now() - updatedMs : Number.POSITIVE_INFINITY;
      if (ageMs < COVER_CAPTURE_PEER_PENDING_GRACE_MS) {
        inFlightCover.delete(projectId);
        return { ok: false, reason: "in_flight", baselineUpdatedAt: baseline.updatedAt };
      }
      console.warn(
        `[projectCoverCapture] reclaiming stale DB pending ageMs=${Math.round(ageMs)} projectId=${projectId}`
      );
    }
    return { ok: true, baselineUpdatedAt: baseline.updatedAt, db };
  } catch (e) {
    inFlightCover.delete(projectId);
    throw e;
  }
}

async function executeCoverCaptureBody(
  db: SupabaseClient,
  projectId: string,
  gate: { cancelled: boolean }
): Promise<void> {
  const assertActive = () => {
    if (gate.cancelled) {
      throw new Error("cover capture cancelled (job timed out)");
    }
  };

  await updateProjectCoverState(db, projectId, {
    status: "pending",
    error: null,
  });
  assertActive();

  console.log(`[projectCoverCapture] resolve preview begin projectId=${projectId}`);
  const { url, extraHeaders } = await resolveCoverCapturePreviewUrl(db, projectId);
  assertActive();
  previewUrlAllowedForScreenshot(url);
  console.log(`[projectCoverCapture] screenshot begin url=${url} projectId=${projectId}`);

  const jpeg = await screenshotHomeViewportViaService(url, extraHeaders);
  assertActive();
  console.log(`[projectCoverCapture] upload begin bytes=${jpeg.length} projectId=${projectId}`);

  await uploadCoverScreenshot(db, projectId, jpeg);
  assertActive();

  await updateProjectCoverState(db, projectId, {
    status: "ready",
    storageRelativePath: COVER_STORAGE_RELATIVE_PATH,
    error: null,
  });
  console.log(`[projectCoverCapture] ready: ${projectId}`);
}

async function executeCoverCapture(
  db: SupabaseClient,
  projectId: string,
  options?: { bypassEnvDisable?: boolean }
): Promise<void> {
  if (coverCaptureDisabledEnv() && !options?.bypassEnvDisable) {
    console.log(`[projectCoverCapture] SKIP (OPEN_OX_COVER_CAPTURE=0): ${projectId}`);
    return;
  }

  const gate = { cancelled: false };
  try {
    await withJobTimeout(
      executeCoverCaptureBody(db, projectId, gate),
      COVER_CAPTURE_JOB_TIMEOUT_MS,
      "cover capture job"
    );
  } catch (err) {
    gate.cancelled = true;
    const msg = truncateErr(err instanceof Error ? err.message : String(err));
    console.error(`[projectCoverCapture] failed ${projectId}:`, msg);
    try {
      await updateProjectCoverState(db, projectId, {
        status: "failed",
        error: msg,
      });
    } catch (e) {
      console.error(`[projectCoverCapture] persist failed state error:`, e);
    }
  }
}

export type RunCaptureProjectCoverOptions = {
  /** Manual Studio trigger: run even when OPEN_OX_COVER_CAPTURE=0 */
  bypassEnvDisable?: boolean;
};

export async function runCaptureProjectCover(
  projectId: string,
  options?: RunCaptureProjectCoverOptions
): Promise<void> {
  const acquired = await tryAcquireCoverCapture(projectId);
  if (!acquired.ok) {
    if (acquired.reason === "no_service_role") {
      console.warn("[projectCoverCapture] SKIP: SUPABASE_SERVICE_ROLE_KEY not configured");
    }
    return;
  }

  try {
    await executeCoverCapture(acquired.db, projectId, options);
  } finally {
    inFlightCover.delete(projectId);
  }
}

/** Fire-and-forget after successful generation — never blocks SSE. */
export function scheduleCaptureProjectCover(projectId: string): void {
  void runCaptureProjectCover(projectId).catch((e) =>
    console.error(`[projectCoverCapture] unexpected: ${projectId}`, e)
  );
}

/**
 * Manual capture from Studio — bypasses OPEN_OX_COVER_CAPTURE=0.
 * Returns whether a new job was queued or one is already in flight (with poll baseline).
 */
export async function scheduleManualCaptureProjectCover(
  projectId: string
): Promise<CoverScheduleResult> {
  const acquired = await tryAcquireCoverCapture(projectId);
  if (!acquired.ok) {
    if (acquired.reason === "no_service_role") {
      throw new Error("SERVICE_ROLE");
    }
    return { status: "in_flight", baselineUpdatedAt: acquired.baselineUpdatedAt };
  }

  void (async () => {
    try {
      await executeCoverCapture(acquired.db, projectId, { bypassEnvDisable: true });
    } catch (e) {
      console.error(`[projectCoverCapture] manual unexpected: ${projectId}`, e);
    } finally {
      inFlightCover.delete(projectId);
    }
  })();

  return { status: "queued", baselineUpdatedAt: acquired.baselineUpdatedAt };
}
