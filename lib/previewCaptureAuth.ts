/**
 * Shared secret so server-side cover capture can fetch `/site-previews` without an owner session.
 * Browser users never send this header — Studio still uses cookies.
 */

import { timingSafeEqual } from "node:crypto";

export const PREVIEW_CAPTURE_SECRET_HEADER = "x-open-ox-preview-capture";

export function getPreviewCaptureSecret(): string | null {
  const s = process.env.OPEN_OX_PREVIEW_CAPTURE_SECRET?.trim();
  return s || null;
}

/** Timing-safe equality for capture secrets (empty/missing never matches). */
export function previewCaptureSecretMatches(provided: string | null | undefined): boolean {
  const expected = getPreviewCaptureSecret();
  if (!expected || provided == null) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function previewCaptureExtraHeaders(): Record<string, string> | null {
  const secret = getPreviewCaptureSecret();
  if (!secret) return null;
  return { [PREVIEW_CAPTURE_SECRET_HEADER]: secret };
}
