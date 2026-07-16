/**
 * Cache-Control + upstream fetch policy for `/site-previews` proxy.
 * Aligns with `docs/preview-public-static-spec.md` §3.1.
 */

/** Hashed Next static chunks/media under `_next/static/` — safe for long CDN/browser cache. */
export function isImmutablePreviewStaticRel(rel: string): boolean {
  const normalized = rel.replace(/^\/+/, "");
  return normalized.startsWith("_next/static/");
}

export function isPreviewHtmlRel(rel: string): boolean {
  const normalized = rel.replace(/^\/+/, "").toLowerCase();
  if (!normalized || normalized === "index.html") return true;
  return normalized.endsWith(".html");
}

/**
 * Browser / shared-cache directives for a proxied preview object.
 * HTML stays short-lived (fixed URL, overwrite-on-publish); hashed static is immutable.
 */
export function cacheControlForPreviewRel(rel: string): string {
  if (isImmutablePreviewStaticRel(rel)) {
    return "public, max-age=31536000, immutable";
  }
  if (isPreviewHtmlRel(rel)) {
    return "public, max-age=0, must-revalidate";
  }
  // Images / fonts / other public assets under the preview tree — short shared cache.
  return "public, max-age=60, s-maxage=60";
}

/** Allow Next/undici (and edge) to reuse Storage responses for immutable paths. */
export function upstreamFetchCacheMode(rel: string): RequestCache {
  return isImmutablePreviewStaticRel(rel) ? "default" : "no-store";
}
