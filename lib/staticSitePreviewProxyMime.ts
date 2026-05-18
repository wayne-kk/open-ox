/**
 * MIME mapping for `/site-previews/...` proxy responses (no Storage / env side effects; safe for unit tests).
 */

export function contentTypeForRelPath(rel: string): string {
  const lower = rel.toLowerCase();
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".apng")) return "image/apng";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

/**
 * Proxy responses set `X-Content-Type-Options: nosniff`, so the type must be correct: unknown extensions
 * cannot fall back to `application/octet-stream` for images/fonts or browsers show broken media.
 * When we cannot infer from the path, use upstream `Content-Type` if sensible.
 */
export function resolveProxiedContentType(
  rel: string,
  upstreamContentType: string | null | undefined
): string {
  const mapped = contentTypeForRelPath(rel);
  if (mapped !== "application/octet-stream") {
    return mapped;
  }
  const raw = upstreamContentType?.split(";")[0]?.trim();
  if (!raw) return "application/octet-stream";
  const low = raw.toLowerCase();
  if (low.startsWith("multipart/")) {
    return "application/octet-stream";
  }
  if (low === "text/plain") {
    const l = rel.toLowerCase();
    const textish =
      l.endsWith(".html") ||
      l.endsWith(".css") ||
      l.endsWith(".js") ||
      l.endsWith(".mjs") ||
      l.endsWith(".json") ||
      l.endsWith(".txt") ||
      l.endsWith(".svg") ||
      l.endsWith(".map");
    if (!textish) {
      return "application/octet-stream";
    }
  }
  return raw;
}
