import type { UserProvidedImage } from "../types";
import { extractGoogleImageUrlsFromText } from "./userProvidedImageEnforcement";

function trimOrUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** Caption text after a URL on the same line (e.g. `url — bar interior`). */
export function extractCaptionAfterUrlOnLine(line: string, url: string): string | undefined {
  const idx = line.indexOf(url);
  if (idx < 0) return undefined;
  const rest = line.slice(idx + url.length).trim();
  if (!rest) return undefined;
  const dashMatch = rest.match(/^(?:[-–—]\s*|:+\s*)(.+)$/);
  if (dashMatch?.[1]) return trimOrUndefined(dashMatch[1]);
  return undefined;
}

/** Scan prompt lines for Google image URLs + optional same-line captions. */
export function extractUserProvidedImagesFromPrompt(text: string): UserProvidedImage[] {
  if (!text.trim()) return [];

  const urls = extractGoogleImageUrlsFromText(text);
  if (urls.length === 0) return [];

  const lines = text.split(/\r?\n/);
  const images: UserProvidedImage[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    let caption: string | undefined;
    for (const line of lines) {
      if (!line.includes(url)) continue;
      caption = extractCaptionAfterUrlOnLine(line, url);
      if (caption) break;
    }

    images.push({ url, ...(caption ? { caption } : {}) });
  }

  return images;
}

export function mergeUserProvidedImages(
  existing: UserProvidedImage[],
  incoming: UserProvidedImage[]
): UserProvidedImage[] {
  const byUrl = new Map<string, UserProvidedImage>();
  for (const img of existing) {
    byUrl.set(img.url, { ...img });
  }
  for (const img of incoming) {
    const prev = byUrl.get(img.url);
    byUrl.set(img.url, {
      url: img.url,
      caption: trimOrUndefined(img.caption) ?? prev?.caption,
      role: trimOrUndefined(img.role) ?? prev?.role,
    });
  }
  return [...byUrl.values()];
}

export function seedUserProvidedImagesFromPrompt(
  images: UserProvidedImage[],
  promptText: string
): { images: UserProvidedImage[]; addedFromPromptScan: number } {
  const scanned = extractUserProvidedImagesFromPrompt(promptText);
  const merged = mergeUserProvidedImages(images, scanned);
  return {
    images: merged,
    addedFromPromptScan: merged.length - images.length,
  };
}

/** Scan multiple source texts (e.g. merged brief + bootstrap / intent session). */
export function seedUserProvidedImagesFromTexts(
  images: UserProvidedImage[],
  texts: string[]
): { images: UserProvidedImage[]; addedFromPromptScan: number } {
  let current = images;
  let totalAdded = 0;
  for (const text of texts) {
    const result = seedUserProvidedImagesFromPrompt(current, text);
    totalAdded += result.addedFromPromptScan;
    current = result.images;
  }
  return { images: current, addedFromPromptScan: totalAdded };
}
