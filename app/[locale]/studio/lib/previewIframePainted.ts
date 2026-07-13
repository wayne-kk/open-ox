/**
 * Detect when a Studio preview iframe has something usable on screen.
 *
 * Prefer DOM `interactive` / `DOMContentLoaded` over the iframe `load` event —
 * `load` waits for images, fonts, and third-party assets, so the page can already
 * be visible under a translucent overlay while loading stays stuck.
 */

export function previewDocumentLooksPainted(doc: Document | null | undefined): boolean {
  if (!doc?.documentElement || !doc.body) return false;
  const href = doc.URL || doc.location?.href || "";
  if (!href || href === "about:blank") return false;
  const state = doc.readyState;
  return state === "interactive" || state === "complete";
}

/** After DOM is ready, wait two animation frames so the first paint can land. */
export function afterNextPaint(cb: () => void): () => void {
  let cancelled = false;
  const id1 = requestAnimationFrame(() => {
    const id2 = requestAnimationFrame(() => {
      if (!cancelled) cb();
    });
    if (cancelled) cancelAnimationFrame(id2);
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(id1);
  };
}
