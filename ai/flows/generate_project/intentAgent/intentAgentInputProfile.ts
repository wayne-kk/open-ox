/**
 * Classifies intent-agent input for observability (trace / metrics).
 * Does NOT change which tools are registered — all tools stay available.
 */

const HTTP_URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** Hosts that are image/CDN assets, not marketing-site URLs for reference_site_digest. */
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

const REFERENCE_SITE_INTENT_RE =
  /\b(参考|模仿|仿照|照着|like\s+this\s+site|similar\s+to|inspired\s+by|clone\s+the\s+layout|match\s+the\s+layout)\b/i;

const CONTENT_PACK_SIGNAL_RE =
  /\b(hours|opening\s+hours|营业时间|menu|菜单|testimonial|review|评价|address|地址|phone|电话|palette|配色|#[0-9a-f]{3,8}\b)/i;

export type IntentAgentInputProfile =
  | "sparse"
  | "substantive_brief"
  | "reference_site_focus";

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

export function classifyIntentAgentInputProfile(userMessage: string): IntentAgentInputProfile {
  const text = userMessage.trim();
  if (!text) return "sparse";

  const refCandidates = listReferenceSiteCandidateUrls(text);
  const explicitReferenceIntent = REFERENCE_SITE_INTENT_RE.test(text);

  if (explicitReferenceIntent && refCandidates.length > 0) {
    return "reference_site_focus";
  }

  const substantiveLength = text.length >= 400;
  const contentPackSignals = CONTENT_PACK_SIGNAL_RE.test(text);
  const manyUrls = extractHttpUrls(text).length >= 3;

  if (substantiveLength && (contentPackSignals || manyUrls)) {
    return "substantive_brief";
  }

  if (refCandidates.length > 0 && !substantiveLength) {
    return "reference_site_focus";
  }

  return "sparse";
}
