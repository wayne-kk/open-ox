/**
 * HTTP client for the Screenshot Service (Playwright lives only in that process).
 * Default: http://127.0.0.1:3921 — start with `pnpm screenshot:dev` or PM2 open-ox-screenshot.
 */

import type { ReferencePageCapture } from "@/lib/reference/referencePageCaptureTypes";

export type { ReferencePageCapture };

const DEFAULT_SCREENSHOT_URL = "http://127.0.0.1:3921";

export function getScreenshotServiceBaseUrl(): string {
  const raw = process.env.OPEN_OX_SCREENSHOT_URL?.trim();
  return (raw || DEFAULT_SCREENSHOT_URL).replace(/\/$/, "");
}

function getScreenshotSecret(): string | null {
  const a = process.env.OPEN_OX_SCREENSHOT_SECRET?.trim();
  if (a) return a;
  const b = process.env.OPEN_OX_PREVIEW_CAPTURE_SECRET?.trim();
  return b || null;
}

function serviceHint(): string {
  return `Start the screenshot service: pnpm screenshot:dev (or PM2 open-ox-screenshot). Base URL: ${getScreenshotServiceBaseUrl()}`;
}

async function screenshotFetch(
  path: string,
  init: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const secret = getScreenshotSecret();
  if (!secret) {
    throw new Error(
      `Screenshot client: set OPEN_OX_SCREENSHOT_SECRET or OPEN_OX_PREVIEW_CAPTURE_SECRET. ${serviceHint()}`
    );
  }

  const { timeoutMs, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${getScreenshotServiceBaseUrl()}${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(rest.headers || {}),
      },
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Screenshot service timed out after ${timeoutMs}ms. ${serviceHint()}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Screenshot service unreachable (${msg}). ${serviceHint()}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function captureCoverViewportJpeg(options: {
  url: string;
  extraHeaders?: Record<string, string> | null;
  polish?: boolean;
}): Promise<Buffer> {
  const res = await screenshotFetch("/v1/cover-viewport", {
    method: "POST",
    timeoutMs: 180_000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: options.url,
      extraHeaders: options.extraHeaders ?? null,
      polish: options.polish !== false,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(`Screenshot cover-viewport failed (${res.status}): ${detail}`);
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function captureReferencePage(url: string): Promise<ReferencePageCapture> {
  const res = await screenshotFetch("/v1/reference-page", {
    method: "POST",
    timeoutMs: 60_000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: `Screenshot reference-page failed (${res.status}): ${detail}` };
  }

  return (await res.json()) as ReferencePageCapture;
}
