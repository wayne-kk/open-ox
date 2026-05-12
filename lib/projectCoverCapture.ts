/**
 * Background job: desktop first-viewport JPEG (1480×960) → Storage → DB.
 * Server-only. Requires SUPABASE_SERVICE_ROLE_KEY and Chromium (Playwright).
 */

import { startDevServer } from "@/lib/devServerManager";
import { previewUrlAllowedForScreenshot } from "@/lib/previewScreenshotUrl";
import { updateProjectCoverState } from "@/lib/projectManager";
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

async function screenshotHomeViewport(previewOrigin: string): Promise<Buffer> {
  previewUrlAllowedForScreenshot(previewOrigin);

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Install playwright: `pnpm add playwright` then `pnpm exec playwright install chromium`");
  }

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: {
        width: COVER_VIEWPORT_WIDTH,
        height: COVER_VIEWPORT_HEIGHT,
      },
      deviceScaleFactor: 1,
    });
    const home = new URL("/", previewOrigin).toString();
    await page.goto(home, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1200);
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

export type RunCaptureProjectCoverOptions = {
  /** Manual Studio trigger: run even when OPEN_OX_COVER_CAPTURE=0 */
  bypassEnvDisable?: boolean;
};

export async function runCaptureProjectCover(
  projectId: string,
  options?: RunCaptureProjectCoverOptions
): Promise<void> {
  let db: SupabaseClient;
  try {
    db = createSupabaseServiceRoleClient();
  } catch {
    console.warn("[projectCoverCapture] SKIP: SUPABASE_SERVICE_ROLE_KEY not configured");
    return;
  }

  if (coverCaptureDisabledEnv() && !options?.bypassEnvDisable) {
    console.log(`[projectCoverCapture] SKIP (OPEN_OX_COVER_CAPTURE=0): ${projectId}`);
    return;
  }

  if (inFlightCover.has(projectId)) {
    return;
  }
  inFlightCover.add(projectId);

  try {
    await updateProjectCoverState(db, projectId, {
      status: "pending",
      error: null,
    });

    const { url } = await startDevServer(db, projectId);
    previewUrlAllowedForScreenshot(url);

    const jpeg = await screenshotHomeViewport(url);

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

/** Manual capture from Studio — bypasses OPEN_OX_COVER_CAPTURE=0. */
export function scheduleManualCaptureProjectCover(projectId: string): void {
  void runCaptureProjectCover(projectId, { bypassEnvDisable: true }).catch((e) =>
    console.error(`[projectCoverCapture] manual unexpected: ${projectId}`, e)
  );
}
