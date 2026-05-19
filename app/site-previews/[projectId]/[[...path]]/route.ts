import { NextResponse } from "next/server";

import {
  SITE_PREVIEWS_BUCKET,
  resolveProxiedContentType,
} from "@/lib/staticSitePreview";

export const runtime = "nodejs";

/**
 * Build Supabase Storage public object URL with each path segment encoded.
 * `getPublicUrl` can emit paths that break fetch/proxies when keys contain reserved URL characters.
 */
function publicStorageObjectUrl(keyUnderBucket: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  const encodedPath = keyUnderBucket
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${SITE_PREVIEWS_BUCKET}/${encodedPath}`;
}

/** Drop empty segments from `//`, trailing slashes, etc. — avoids false "Invalid path" 400s. */
function normalizePreviewPathSegments(path: string[] | undefined): string[] {
  return (path ?? []).filter((s) => s.length > 0);
}

function isSafePreviewSegments(segments: string[]): boolean {
  return segments.every((s) => !s.includes("..") && !s.includes("\\"));
}

async function proxyFromStorage(
  projectId: string,
  rel: string,
  method: "GET" | "HEAD"
): Promise<NextResponse> {
  const objectKey = `p/${projectId}/${rel}`;
  let storageUrl: string;
  try {
    storageUrl = publicStorageObjectUrl(objectKey);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error";
    return new NextResponse(message, { status: 500 });
  }

  const upstream = await fetch(storageUrl, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);

  if (!upstream) {
    return new NextResponse("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(upstream.statusText, { status: upstream.status });
  }

  const contentType = resolveProxiedContentType(rel, upstream.headers.get("content-type"));

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("etag", etag);

  // Intentionally omit Storage `Content-Security-Policy` (includes `sandbox` without allow-scripts),
  // which blocks Next.js static chunks inside an iframe.

  if (method === "HEAD") {
    const len = upstream.headers.get("content-length");
    if (len) headers.set("content-length", len);
    return new NextResponse(null, { status: 200, headers });
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}

type Ctx = { params: Promise<{ projectId: string; path?: string[] }> };

function canonicalTrailingSlashRedirect(req: Request, segments: string[]): NextResponse | null {
  if (segments.length > 0) return null;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/")) return null;
  const dest = `${url.pathname}/${url.search}`;
  return NextResponse.redirect(new URL(dest, url.origin), 307);
}

export async function GET(req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return new NextResponse("Missing projectId", { status: 400 });
  }
  const segments = normalizePreviewPathSegments(path);
  if (!isSafePreviewSegments(segments)) {
    return new NextResponse("Invalid path", { status: 400 });
  }
  const redirect = canonicalTrailingSlashRedirect(req, segments);
  if (redirect) return redirect;
  const rel = segments.length ? segments.join("/") : "index.html";
  return proxyFromStorage(id, rel, "GET");
}

export async function HEAD(req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return new NextResponse(null, { status: 400 });
  }
  const segments = normalizePreviewPathSegments(path);
  if (!isSafePreviewSegments(segments)) {
    return new NextResponse(null, { status: 400 });
  }
  const redirect = canonicalTrailingSlashRedirect(req, segments);
  if (redirect) return redirect;
  const rel = segments.length ? segments.join("/") : "index.html";
  return proxyFromStorage(id, rel, "HEAD");
}
