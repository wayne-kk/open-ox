/** Pure cover-capture scheduling / poll rules (no Playwright, no DB I/O). */

/**
 * `/site-previews` returns a bare `Forbidden` body (HTTP 403) when Playwright has no
 * owner session cookie. Covers must not upload that screenshot as a project card image.
 */
export function isAuthGatedPreviewFailureBody(bodyText: string): boolean {
  const t = bodyText.replace(/\s+/g, " ").trim();
  if (!t) return false;
  // Exact body from `new NextResponse("Forbidden", { status: 403 })`.
  if (/^forbidden$/i.test(t)) return true;
  // Tolerate tiny wrappers / newlines already collapsed above.
  return t.length < 40 && /^forbidden\b/i.test(t);
}

export const COVER_CAPTURE_PENDING_FRESH_MS = 3 * 60 * 1000;
export const COVER_CAPTURE_POLL_TIMEOUT_MS = 3 * 60 * 1000;
export const COVER_CAPTURE_POLL_INTERVAL_MS = 2_000;
export const COVER_CAPTURE_FONT_READY_TIMEOUT_MS = 5_000;
export const COVER_CAPTURE_POST_FONT_SETTLE_MS = 400;

/**
 * CSS injected before cover/Feishu homepage screenshots.
 *
 * next/font latin Inter ends with `font-family: Inter, "Inter Fallback"` where
 * Fallback is `local(Arial)` with no unicode-range — CJK never reaches system
 * fonts and renders as tofu boxes when the host lacks a last-resort CJK face
 * (typical Linux/Docker). Re-declare `Inter Fallback` for CJK ranges and append
 * explicit CJK locals on `html`/`body`.
 */
export function buildCoverCaptureCjkFallbackCss(): string {
  const cjkLocals = [
    'local("PingFang SC")',
    'local("Hiragino Sans GB")',
    'local("Noto Sans CJK SC")',
    'local("Noto Sans SC")',
    'local("WenQuanYi Micro Hei")',
    'local("Microsoft YaHei")',
  ].join(", ");
  const cjkRange =
    "U+4E00-9FFF, U+3400-4DBF, U+F900-FAFF, U+3000-303F, U+FF00-FFEF";
  return `
@font-face {
  font-family: "Inter Fallback";
  src: ${cjkLocals};
  unicode-range: ${cjkRange};
}
@font-face {
  font-family: "__ox_cjk_capture";
  src: ${cjkLocals};
  unicode-range: ${cjkRange};
}
html, body {
  font-family: Inter, "Inter Fallback", "__ox_cjk_capture", "PingFang SC",
    "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
}
`.trim();
}

export type CoverScheduleStatus = "queued" | "in_flight";

export type CoverScheduleResult = {
  status: CoverScheduleStatus;
  baselineUpdatedAt: string | null;
};

export function isNewerCoverTimestamp(
  current: string | null | undefined,
  baseline: string | null | undefined
): boolean {
  if (!current?.trim()) return false;
  if (!baseline?.trim()) return true;
  const c = Date.parse(current);
  const b = Date.parse(baseline);
  if (!Number.isFinite(c)) return false;
  if (!Number.isFinite(b)) return true;
  return c > b;
}

export function isFreshCoverPending(
  status: string | null | undefined,
  updatedAt: string | null | undefined,
  nowMs: number,
  windowMs: number = COVER_CAPTURE_PENDING_FRESH_MS
): boolean {
  if (status !== "pending") return false;
  if (!updatedAt?.trim()) return false;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= windowMs;
}

export type CoverPollVerdict = "continue" | "success" | "failed" | "timeout";

export type CoverPollEvaluation = {
  verdict: CoverPollVerdict;
  /** Truncated server error when verdict is failed */
  errorHint?: string;
};

function truncateHint(msg: string | null | undefined, max = 120): string | undefined {
  const s = (msg ?? "").trim();
  if (!s) return undefined;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/**
 * Studio poll step: success only when ready with updatedAt newer than the POST baseline.
 * Failed only when failed with a newer timestamp (avoids treating a prior failure as this run).
 */
export function evaluateCoverCapturePoll(input: {
  baselineUpdatedAt: string | null;
  status: string | null | undefined;
  updatedAt: string | null | undefined;
  error?: string | null;
  elapsedMs: number;
  timeoutMs?: number;
}): CoverPollEvaluation {
  const timeoutMs = input.timeoutMs ?? COVER_CAPTURE_POLL_TIMEOUT_MS;
  if (input.elapsedMs >= timeoutMs) {
    return { verdict: "timeout" };
  }

  const newer = isNewerCoverTimestamp(input.updatedAt, input.baselineUpdatedAt);

  if (input.status === "ready" && newer) {
    return { verdict: "success" };
  }
  if (input.status === "failed" && newer) {
    return { verdict: "failed", errorHint: truncateHint(input.error) };
  }
  return { verdict: "continue" };
}
