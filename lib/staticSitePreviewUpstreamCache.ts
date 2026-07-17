/**
 * Process-local cache for Storage → `/site-previews` proxy responses.
 * Targets hashed `_next/static/**` so warm chunks skip the Supabase RTT
 * (Form-2 thin edge before a real CDN/Worker).
 */

import { isImmutablePreviewStaticRel } from "@/lib/staticSitePreviewProxyCache";

export type CachedUpstreamObject = {
  body: Buffer;
  contentType: string | null;
  etag: string | null;
  contentLength: string | null;
};

type CacheEntry = {
  value: CachedUpstreamObject;
  expiresAt: number;
  bytes: number;
};

const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h (content-hashed paths)

const cache = new Map<string, CacheEntry>();
let totalBytes = 0;

function maxEntries(): number {
  const raw = process.env.OPEN_OX_PREVIEW_UPSTREAM_CACHE_ENTRIES?.trim();
  if (!raw) return DEFAULT_MAX_ENTRIES;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_ENTRIES;
}

function maxBytes(): number {
  const raw = process.env.OPEN_OX_PREVIEW_UPSTREAM_CACHE_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_BYTES;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_BYTES;
}

function ttlMs(): number {
  const raw = process.env.OPEN_OX_PREVIEW_UPSTREAM_CACHE_TTL_MS?.trim();
  if (!raw) return DEFAULT_TTL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TTL_MS;
}

export function previewUpstreamCacheKey(projectId: string, rel: string): string {
  return `${projectId}\0${rel.replace(/^\/+/, "")}`;
}

/** Only cache content-hashed Next static assets. */
export function shouldCachePreviewUpstream(rel: string): boolean {
  if (maxEntries() === 0 || maxBytes() === 0) return false;
  return isImmutablePreviewStaticRel(rel);
}

function evictExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      totalBytes -= entry.bytes;
      cache.delete(key);
    }
  }
}

function evictToFit(neededBytes: number): void {
  const entriesCap = maxEntries();
  const bytesCap = maxBytes();
  while (
    cache.size > 0 &&
    (cache.size >= entriesCap || totalBytes + neededBytes > bytesCap)
  ) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const entry = cache.get(oldest);
    cache.delete(oldest);
    if (entry) totalBytes -= entry.bytes;
  }
}

export function getCachedPreviewUpstream(
  projectId: string,
  rel: string,
  nowMs: number = Date.now()
): CachedUpstreamObject | null {
  if (!shouldCachePreviewUpstream(rel)) return null;
  evictExpired(nowMs);
  const key = previewUpstreamCacheKey(projectId, rel);
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs) {
    totalBytes -= hit.bytes;
    cache.delete(key);
    return null;
  }
  // Refresh LRU order
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

export function setCachedPreviewUpstream(
  projectId: string,
  rel: string,
  value: CachedUpstreamObject,
  nowMs: number = Date.now()
): void {
  if (!shouldCachePreviewUpstream(rel)) return;
  const bytes = value.body.byteLength;
  if (bytes <= 0 || bytes > maxBytes()) return;

  evictExpired(nowMs);
  const key = previewUpstreamCacheKey(projectId, rel);
  const prev = cache.get(key);
  if (prev) {
    totalBytes -= prev.bytes;
    cache.delete(key);
  }

  evictToFit(bytes);
  if (bytes > maxBytes()) return;

  cache.set(key, {
    value,
    bytes,
    expiresAt: nowMs + ttlMs(),
  });
  totalBytes += bytes;
}

/** Test helper */
export function clearPreviewUpstreamCache(): void {
  cache.clear();
  totalBytes = 0;
}

/** Test / diagnostics */
export function previewUpstreamCacheStats(): { entries: number; bytes: number } {
  return { entries: cache.size, bytes: totalBytes };
}
