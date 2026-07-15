/**
 * Playwright capture of an external reference URL (style/layout analysis).
 * Used by the screenshot service only — Next must not import this module.
 */

import { launchChromium } from "@/lib/playwright/launchChromium";
import { assertUrlSafeForServerFetch } from "@/lib/net/safePublicUrl";
import type { ReferencePageCapture } from "@/lib/reference/referencePageCaptureTypes";

const VIEWPORT = { width: 1440, height: 900 };
const MAX_VISIBLE_TEXT = 24_000;
const NAV_TIMEOUT_MS = 28_000;
const SETTLE_MS = 2_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function captureExternalReferencePageImpl(
  startUrl: string
): Promise<ReferencePageCapture> {
  let initial: URL;
  try {
    initial = await assertUrlSafeForServerFetch(startUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const browser = await launchChromium();

  try {
    const page = await browser.newPage({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      deviceScaleFactor: 1,
    });

    await page.goto(initial.href, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const after = page.url();
    try {
      await assertUrlSafeForServerFetch(after);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Redirect landed on disallowed URL: ${msg}` };
    }

    await sleep(SETTLE_MS);

    const pageTitle = (await page.title().catch(() => "")) || "";
    const visibleText = await page
      .evaluate(() => {
        const el = document.body;
        if (!el) return "";
        return (el.innerText || "").replace(/\s+/g, " ").trim();
      })
      .catch(() => "");

    const clipped =
      visibleText.length > MAX_VISIBLE_TEXT
        ? `${visibleText.slice(0, MAX_VISIBLE_TEXT)}\n\n…(truncated)`
        : visibleText;

    const buf = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    return {
      ok: true,
      finalUrl: after,
      pageTitle,
      pngBase64: Buffer.from(buf).toString("base64"),
      visibleText: clipped,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Playwright capture failed: ${msg}` };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
