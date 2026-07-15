/**
 * Playwright homepage viewport capture + optional cinematic polish.
 * Used by the screenshot service only — Next must not import this module.
 */

import {
  buildCoverCaptureCjkFallbackCss,
  COVER_CAPTURE_CJK_FONT_STACK,
  COVER_CAPTURE_FONT_CSS_VARS,
  COVER_CAPTURE_FONT_READY_TIMEOUT_MS,
  COVER_CAPTURE_POST_FONT_SETTLE_MS,
  isAuthGatedPreviewFailureBody,
} from "@/lib/coverCaptureOrchestration";
import { polishCoverJpeg } from "@/lib/coverImagePolish";
import { launchChromium } from "@/lib/playwright/launchChromium";
import { previewUrlAllowedForScreenshot } from "@/lib/previewScreenshotUrl";

export const COVER_VIEWPORT_WIDTH = 1480;
export const COVER_VIEWPORT_HEIGHT = 960;

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

export async function screenshotHomeViewport(
  previewEntryUrl: string,
  extraHeaders: Record<string, string> | null
): Promise<Buffer> {
  previewUrlAllowedForScreenshot(previewEntryUrl);

  if (previewEntryUrl.includes("/site-previews/") && !extraHeaders) {
    throw new Error(
      "Cover capture refused auth-gated /site-previews URL without OPEN_OX_PREVIEW_CAPTURE_SECRET"
    );
  }

  const browser = await launchChromium();
  try {
    const page = await browser.newPage({
      viewport: {
        width: COVER_VIEWPORT_WIDTH,
        height: COVER_VIEWPORT_HEIGHT,
      },
      deviceScaleFactor: 1,
      ...(extraHeaders ? { extraHTTPHeaders: extraHeaders } : {}),
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
    const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    if (isAuthGatedPreviewFailureBody(bodyText)) {
      throw new Error(
        "Cover capture landed on Forbidden (auth-gated preview). Set OPEN_OX_PREVIEW_CAPTURE_SECRET."
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.addStyleTag({ content: buildCoverCaptureCjkFallbackCss() });
    await page.evaluate(
      ({ cssVars, cjkStack }) => {
        const root = document.documentElement;
        const cs = getComputedStyle(root);
        for (const prop of cssVars) {
          const cur = cs.getPropertyValue(prop).trim();
          if (!cur) continue;
          if (/\bNoto Sans CJK SC\b/i.test(cur) || /\bPingFang SC\b/i.test(cur)) continue;
          root.style.setProperty(prop, `${cur}, ${cjkStack}`);
        }
      },
      {
        cssVars: [...COVER_CAPTURE_FONT_CSS_VARS],
        cjkStack: COVER_CAPTURE_CJK_FONT_STACK,
      }
    );
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

export async function jpegWithCoverPolish(raw: Buffer): Promise<Buffer> {
  try {
    return await polishCoverJpeg(raw, {
      width: COVER_VIEWPORT_WIDTH,
      height: COVER_VIEWPORT_HEIGHT,
    });
  } catch (e) {
    console.warn("[coverViewportCapture] polish fallback (raw jpeg):", e);
    return raw;
  }
}

export async function captureCoverViewportJpeg(options: {
  url: string;
  extraHeaders?: Record<string, string> | null;
  polish?: boolean;
}): Promise<Buffer> {
  const raw = await screenshotHomeViewport(options.url, options.extraHeaders ?? null);
  if (options.polish === false) return raw;
  return jpegWithCoverPolish(raw);
}
