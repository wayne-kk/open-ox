import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  SITE_PREVIEWS_BUCKET,
  resolveProxiedContentType,
} from "@/lib/staticSitePreview";

export const runtime = "nodejs";

function publicStorageObjectUrl(keyUnderBucket: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  const { data } = createClient(supabaseUrl, publishable || "anon-placeholder").storage
    .from(SITE_PREVIEWS_BUCKET)
    .getPublicUrl(keyUnderBucket);
  return data.publicUrl;
}

function isSafePreviewSegments(segments: string[] | undefined): boolean {
  if (!segments?.length) return true;
  return segments.every((s) => s.length > 0 && !s.includes("..") && !s.includes("\\"));
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

export async function GET(_req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  if (!isSafePreviewSegments(path)) {
    return new NextResponse("Invalid path", { status: 400 });
  }
  const rel = path?.length ? path.join("/") : "index.html";
  return proxyFromStorage(projectId, rel, "GET");
}

export async function HEAD(_req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  if (!isSafePreviewSegments(path)) {
    return new NextResponse(null, { status: 400 });
  }
  const rel = path?.length ? path.join("/") : "index.html";
  return proxyFromStorage(projectId, rel, "HEAD");
}
