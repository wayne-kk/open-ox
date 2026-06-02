import type { UserProvidedContent, UserProvidedImage } from "@/ai/flows/generate_project/types";
import { hasUserProvidedContent } from "@/ai/flows/generate_project/schema/normalizeUserProvidedContent";
import { resolveSiteImageAsset, sanitizeImageFilename } from "@/lib/content/siteImageAsset";

const IMAGE_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

/** Conservative heuristic — only URLs that likely point at image assets. */
export function looksLikeImageUrl(url: string): boolean {
  try {
    const u = new URL(url.replace(/[.,;:!?)]+$/, ""));
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (/googleusercontent\.com|ggpht\.com/i.test(host)) return true;
    if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(path)) return true;
    if (/(^images\.|^img\.|cdn\.|media\.|photos\.)/i.test(host) && !/\.html?$/.test(path)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractImageUrlsFromPrompt(text: string): string[] {
  const matches = text.match(IMAGE_URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)]+$/, "");
    if (!looksLikeImageUrl(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    urls.push(cleaned);
  }
  return urls;
}

function mergeSupplementalImages(
  content: UserProvidedContent | undefined,
  promptUrls: string[]
): UserProvidedImage[] {
  const existing = content?.images ?? [];
  const known = new Set(existing.map((img) => img.url));
  const merged = [...existing];
  for (const url of promptUrls) {
    if (known.has(url)) continue;
    known.add(url);
    merged.push({ url });
  }
  return merged;
}

function filenameBaseForImage(image: UserProvidedImage, index: number): string {
  if (image.caption?.trim()) {
    return sanitizeImageFilename(image.caption.slice(0, 48));
  }
  try {
    const host = new URL(image.url).hostname.split(".")[0] ?? "img";
    return sanitizeImageFilename(`${host}-${index + 1}`);
  } catch {
    return `user-provided-${index + 1}`;
  }
}

export interface PrefetchUserProvidedAssetsResult {
  content: UserProvidedContent | undefined;
  stats: {
    imageTotal: number;
    downloaded: number;
    generated: number;
    failed: number;
  };
}

/**
 * Downloads user-provided image URLs to public/images/user-provided/.
 * On download failure, generates from caption via Ark (when configured).
 */
export async function prefetchUserProvidedAssets(params: {
  content: UserProvidedContent | undefined;
  userInput: string;
}): Promise<PrefetchUserProvidedAssetsResult> {
  const promptUrls = extractImageUrlsFromPrompt(params.userInput);
  const baseContent = params.content ?? {};
  const mergedImages = mergeSupplementalImages(params.content, promptUrls);

  if (mergedImages.length === 0 && !hasUserProvidedContent(baseContent)) {
    return {
      content: undefined,
      stats: { imageTotal: 0, downloaded: 0, generated: 0, failed: 0 },
    };
  }

  const images: UserProvidedImage[] = [];
  let downloaded = 0;
  let generated = 0;
  let failed = 0;

  for (let i = 0; i < mergedImages.length; i += 1) {
    const image = mergedImages[i];
    const filenameBase = filenameBaseForImage(image, i);
    const resolved = await resolveSiteImageAsset({
      sourceUrl: image.url,
      caption: image.caption,
      filenameBase,
    });

    if (resolved.source === "download") downloaded += 1;
    else if (resolved.source === "generated") generated += 1;
    else failed += 1;

    images.push({
      ...image,
      localPath: resolved.publicPath || undefined,
      assetSource:
        resolved.source === "download" || resolved.source === "generated"
          ? resolved.source
          : undefined,
    });
  }

  const content: UserProvidedContent = {
    ...baseContent,
    ...(images.length > 0 ? { images } : {}),
  };

  const normalized = hasUserProvidedContent(content) ? content : undefined;
  return {
    content: normalized,
    stats: {
      imageTotal: mergedImages.length,
      downloaded,
      generated,
      failed,
    },
  };
}

export function formatUserProvidedContentBlock(content: UserProvidedContent | undefined): string {
  if (!hasUserProvidedContent(content) || !content) return "";

  const lines: string[] = [
    "## User-provided content (MUST honor — do not replace with stock, placeholders, or invented copy)",
    "",
    "When the user explicitly provided facts, quotes, menu items, hours, links, or images below:",
    "- Use them faithfully in the UI (verbatim quotes; exact phone, address, website URLs).",
    "- Prefer `localPath` for images when present; do not substitute unrelated stock photography.",
    "- For items not listed below, you may design reasonable supporting copy — but never contradict or overwrite provided facts.",
    "",
  ];

  if (content.business && Object.values(content.business).some(Boolean)) {
    lines.push("### Business facts");
    for (const [key, value] of Object.entries(content.business)) {
      if (value) lines.push(`- **${key}**: ${value}`);
    }
    lines.push("");
  }

  if (content.hours?.length) {
    lines.push("### Hours");
    for (const h of content.hours) lines.push(`- ${h}`);
    lines.push("");
  }

  if (content.palette?.length) {
    lines.push("### Palette");
    for (const p of content.palette) lines.push(`- ${p}`);
    lines.push("");
  }

  if (content.menuItems?.length) {
    lines.push("### Menu / highlights");
    for (const item of content.menuItems) lines.push(`- ${item}`);
    lines.push("");
  }

  if (content.testimonials?.length) {
    lines.push("### Testimonials (render quotes verbatim — do not paraphrase)");
    for (const t of content.testimonials) {
      lines.push(`- Quote: "${t.quote}"`);
      if (t.author) lines.push(`  - Author: ${t.author}`);
      if (t.stars !== undefined) lines.push(`  - Stars: ${t.stars}`);
      if (t.relativeTime) lines.push(`  - When: ${t.relativeTime}`);
    }
    lines.push("");
  }

  if (content.images?.length) {
    lines.push("### Images");
    for (const img of content.images) {
      const path = img.localPath ? ` → use \`${img.localPath}\`` : "";
      const cap = img.caption ? ` — ${img.caption}` : "";
      lines.push(`- ${img.url}${cap}${path}`);
    }
    lines.push("");
  }

  if (content.links?.length) {
    lines.push("### Links");
    for (const link of content.links) {
      lines.push(`- ${link.label ? `${link.label}: ` : ""}${link.url}`);
    }
    lines.push("");
  }

  if (content.notes) {
    lines.push("### Notes");
    lines.push(content.notes);
    lines.push("");
  }

  lines.push(
    "A JSON snapshot is also at `content/user-provided.json` in the site root (read-only reference)."
  );

  return lines.join("\n");
}
