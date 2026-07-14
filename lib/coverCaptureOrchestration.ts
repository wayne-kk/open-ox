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
