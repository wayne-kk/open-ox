/** Best-effort CSS-ish selector path for Modify agent hints (browser-safe copy lives in bridge script). */

const SKIP_TAGS = new Set(["html", "body", "head", "script", "style"]);

function escapeClassToken(token: string): string {
  return token.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

function elementSegment(el: { tagName: string; id?: string | null; className?: string }): string {
  const tag = el.tagName.toLowerCase();
  if (el.id?.trim()) {
    return `${tag}#${escapeClassToken(el.id.trim())}`;
  }
  const classes = (el.className ?? "")
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (classes.length > 0) {
    return `${tag}.${classes.map(escapeClassToken).join(".")}`;
  }
  return tag;
}

/**
 * Build a short selector path from leaf to an ancestor (max depth 5).
 * Used in tests and in the Modify draft builder; the live bridge mirrors this logic.
 */
export function buildSelectorHintFromSegments(segments: string[]): string {
  const trimmed = segments.filter(Boolean).slice(0, 5);
  return trimmed.length > 0 ? trimmed.join(" > ") : "unknown-element";
}

export function buildSelectorHintFromElementLike(
  el: { tagName: string; id?: string | null; className?: string },
  ancestors: Array<{ tagName: string; id?: string | null; className?: string }>
): string {
  const tag = el.tagName?.toLowerCase?.() ?? "";
  if (SKIP_TAGS.has(tag)) {
    return buildSelectorHintFromSegments(ancestors.map(elementSegment));
  }
  return buildSelectorHintFromSegments([...ancestors.map(elementSegment), elementSegment(el)]);
}
