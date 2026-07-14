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

/** System CJK faces for cover/Feishu Playwright screenshots (Docker Noto + macOS PingFang). */
export const COVER_CAPTURE_CJK_FONT_STACK = [
  "PingFang SC",
  "Hiragino Sans GB",
  "Noto Sans CJK SC",
  "Noto Sans SC",
  "Noto Serif CJK SC",
  "WenQuanYi Micro Hei",
  "Microsoft YaHei",
].join(", ");

/**
 * Latin / next/font family names that often appear in generated sites.
 * Without a CJK `unicode-range` face under the same name, Chromium may paint
 * .notdef tofu instead of falling through to system CJK (esp. Linux/Docker).
 */
const COVER_CAPTURE_LATIN_FACES_FOR_CJK = [
  "Inter",
  "Inter Fallback",
  "__Inter_Fallback",
  "__ox_cjk_capture",
  "Lora",
  "Playfair Display",
  "Georgia",
  "Times New Roman",
  "Times",
  "Helvetica Neue",
  "Helvetica",
  "Arial",
  "JetBrains Mono",
  "Courier New",
  "Courier",
  "Cambria",
] as const;

/** Theme CSS variables that commonly hold Latin-only stacks on generated sites. */
export const COVER_CAPTURE_FONT_CSS_VARS = [
  "--font-body",
  "--font-display",
  "--font-sans",
  "--font-serif",
  "--font-mono",
  "--default-font-family",
  "--default-mono-font-family",
] as const;

/**
 * CSS injected before cover/Feishu homepage screenshots.
 *
 * Re-declare common Latin faces for CJK `unicode-range` → `local(Noto/PingFang)`
 * so stacks like `Lora, Georgia, serif` / next/font `Inter Fallback` do not tofu.
 * Pair with `appendCoverCaptureCjkFontStacksInPage` to also extend CSS variables.
 */
export function buildCoverCaptureCjkFallbackCss(): string {
  const cjkLocals = COVER_CAPTURE_CJK_FONT_STACK.split(", ")
    .map((name) => `local("${name}")`)
    .join(", ");
  const cjkRange =
    "U+4E00-9FFF, U+3400-4DBF, U+F900-FAFF, U+3000-303F, U+FF00-FFEF";
  const faceBlocks = COVER_CAPTURE_LATIN_FACES_FOR_CJK.map((family) => {
    const fam = /[^A-Za-z0-9_-]/.test(family) ? `"${family}"` : family;
    return `@font-face {
  font-family: ${fam};
  src: ${cjkLocals};
  unicode-range: ${cjkRange};
}`;
  }).join("\n");
  const cjkStack = COVER_CAPTURE_CJK_FONT_STACK;
  return `
${faceBlocks}
:root, :host {
  --ox-cjk-capture: ${cjkStack};
}
html, body {
  font-family: Inter, "Inter Fallback", "__ox_cjk_capture", ${cjkStack}, sans-serif;
}
`.trim();
}

/**
 * Extends theme font CSS variables (and optionally element stacks) with CJK locals.
 * Pure string helper for tests; Playwright calls the in-page variant.
 */
export function appendCjkToFontFamilyList(
  current: string,
  cjkStack: string = COVER_CAPTURE_CJK_FONT_STACK
): string {
  const cur = current.trim();
  if (!cur) return cjkStack;
  if (/\bNoto Sans CJK SC\b/i.test(cur) || /\bPingFang SC\b/i.test(cur)) return cur;
  return `${cur}, ${cjkStack}`;
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
