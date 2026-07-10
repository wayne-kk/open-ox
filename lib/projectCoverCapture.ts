/**
 * Background job: desktop first-viewport JPEG (1480×960) → cinematic polish → Storage → DB.
 * Server-only. Requires SUPABASE_SERVICE_ROLE_KEY and Chromium (Playwright).
 */

import {
  COVER_CAPTURE_FONT_READY_TIMEOUT_MS,
  COVER_CAPTURE_POST_FONT_SETTLE_MS,
  isFreshCoverPending,
  type CoverScheduleResult,
} from "@/lib/coverCaptureOrchestration";
import { polishCoverJpeg } from "@/lib/coverImagePolish";
import { startDevServer, getExistingLocalPreviewUrl } from "@/lib/devServerManager";
import { previewUrlAllowedForScreenshot } from "@/lib/previewScreenshotUrl";
import { launchChromium } from "@/lib/playwright/launchChromium";
import { getProject, updateProjectCoverState } from "@/lib/projectManager";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadCoverScreenshot } from "@/lib/storage";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const COVER_VIEWPORT_WIDTH = 1480;
const COVER_VIEWPORT_HEIGHT = 960;
/** Relative key under bucket prefix `{projectId}/` */
export const COVER_STORAGE_RELATIVE_PATH = ".open-ox-cover/cover.jpg";

const inFlightCover = new Set<string>();

function coverCaptureDisabledEnv(): boolean {
  return process.env.OPEN_OX_COVER_CAPTURE?.trim() === "0";
}

function truncateErr(msg: string, max = 1900): string {
  const s = msg.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFontsReadyFailOpen(
  page: { evaluate: (fn: () => Promise<unknown>) => Promise<unknown> },
  timeoutMs: number
): Promise<void> {
  try {
    await Promise.race([
      page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())),
      sleep(timeoutMs),
    ]);
  } catch {
    /* fail-open */
  }
}

async function screenshotHomeViewport(previewEntryUrl: string): Promise<Buffer> {
  previewUrlAllowedForScreenshot(previewEntryUrl);

  const browser = await launchChromium();
  try {
    const page = await browser.newPage({
      viewport: {
        width: COVER_VIEWPORT_WIDTH,
        height: COVER_VIEWPORT_HEIGHT,
      },
      deviceScaleFactor: 1,
    });
    const home = (() => {
      try {
        const u = new URL(previewEntryUrl);
        if (u.pathname.toLowerCase().endsWith(".html")) return previewEntryUrl;
      } catch {
        /* fall through */
      }
      return previewEntryUrl.endsWith("/") ? previewEntryUrl : `${previewEntryUrl}/`;
    })();
    await page.goto(home, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForFontsReadyFailOpen(page, COVER_CAPTURE_FONT_READY_TIMEOUT_MS);
    await sleep(COVER_CAPTURE_POST_FONT_SETTLE_MS);
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 82,
      fullPage: false,
    });
    return buf as Buffer;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function jpegWithCoverPolish(raw: Buffer): Promise<Buffer> {
  try {
    return await polishCoverJpeg(raw, {
      width: COVER_VIEWPORT_WIDTH,
      height: COVER_VIEWPORT_HEIGHT,
    });
  } catch (e) {
    console.warn("[projectCoverCapture] polish fallback (raw jpeg):", e);
    return raw;
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
 * Reserve process-local slot first (sync), then refuse if DB has a fresh pending from another worker.
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
      inFlightCover.delete(projectId);
      return { ok: false, reason: "in_flight", baselineUpdatedAt: baseline.updatedAt };
    }
    return { ok: true, baselineUpdatedAt: baseline.updatedAt, db };
  } catch (e) {
    inFlightCover.delete(projectId);
    throw e;
  }
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

  try {
    await updateProjectCoverState(db, projectId, {
      status: "pending",
      error: null,
    });

    const reused = await getExistingLocalPreviewUrl(db, projectId);
    const { url } = reused ?? (await startDevServer(db, projectId));
    previewUrlAllowedForScreenshot(url);

    const rawJpeg = await screenshotHomeViewport(url);
    const jpeg = await jpegWithCoverPolish(rawJpeg);

    await uploadCoverScreenshot(db, projectId, jpeg);

    await updateProjectCoverState(db, projectId, {
      status: "ready",
      storageRelativePath: COVER_STORAGE_RELATIVE_PATH,
      error: null,
    });
    console.log(`[projectCoverCapture] ready: ${projectId}`);
  } catch (err) {
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
