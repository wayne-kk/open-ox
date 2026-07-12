/**
 * URL helpers for intent-agent observability / future tool routing.
 * No keyword-based “intent” classification — that belongs in model judgment or an explicit router later.
 */

const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** Hosts/paths that are image or CDN assets, not marketing-site URLs. */
const ASSET_HOST_SNIPPETS = [
  "googleusercontent.com",
  "gstatic.com",
  "ggpht.com",
  "googleapis.com",
  "maps.googleapis.com",
  "lh3.google",
  "fbcdn.net",
  "cloudinary.com",
  "unsplash.com",
  "images.",
  "/images/",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
];

export function extractHttpUrls(text: string): string[] {
  const matches = text.match(HTTP_URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const u = raw.replace(/[.,;:!?)]+$/, "").trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export function isLikelyAssetUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return ASSET_HOST_SNIPPETS.some((s) => lower.includes(s));
}

export function listReferenceSiteCandidateUrls(text: string): string[] {
  return extractHttpUrls(text).filter((u) => !isLikelyAssetUrl(u));
}
