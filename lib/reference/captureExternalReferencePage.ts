/**
 * Server-side capture of an external reference URL for style/layout analysis.
 * Delegates Playwright to the Screenshot Service (HTTP).
 * SSRF: initial URL is checked here; the service re-checks after navigation.
 */

import { captureReferencePage } from "@/lib/screenshot/client";
import type { ReferencePageCapture } from "@/lib/reference/referencePageCaptureTypes";
import { assertUrlSafeForServerFetch } from "@/lib/net/safePublicUrl";

export type { ReferencePageCapture };

function playwrightDisabled(): boolean {
  return process.env.OPEN_OX_REFERENCE_PLAYWRIGHT?.trim() === "0";
}

export async function captureExternalReferencePage(startUrl: string): Promise<ReferencePageCapture> {
  if (playwrightDisabled()) {
    return { ok: false, error: "Playwright reference capture disabled (OPEN_OX_REFERENCE_PLAYWRIGHT=0)" };
  }

  try {
    await assertUrlSafeForServerFetch(startUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  return captureReferencePage(startUrl);
}
