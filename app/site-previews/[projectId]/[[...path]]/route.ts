import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { canAccessStaticPreview } from "@/lib/auth/projectAccess";
import { getProject } from "@/lib/projectManager";
import {
  PREVIEW_CAPTURE_SECRET_HEADER,
  previewCaptureSecretMatches,
} from "@/lib/previewCaptureAuth";
import {
  SITE_PREVIEWS_BUCKET,
  resolveProxiedContentType,
} from "@/lib/staticSitePreview";
import { mapStorageUpstreamStatus } from "@/lib/staticSitePreviewProxyMime";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  designModeBridgeScriptPath,
  injectDesignModeBridgeIntoHtml,
  shouldInjectDesignModeBridge,
} from "@/lib/studio/designMode/injectBridgeIntoHtml";

export const runtime = "nodejs";

async function assertStaticPreviewAccess(
  projectId: string,
  request: Request
): Promise<NextResponse | null> {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return new NextResponse("Server misconfigured", { status: 503 });
  }
  const project = await getProject(admin, projectId);
  if (!project) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Server-side cover capture (Playwright) — no owner cookie; shared secret only.
  const captureSecret = request.headers.get(PREVIEW_CAPTURE_SECRET_HEADER);
  if (previewCaptureSecretMatches(captureSecret)) {
    return null;
  }

  const session = await getSessionUser();
  const isAdmin = session
    ? await isAdminUser({ supabase: session.supabase, userId: session.user.id })
    : false;
  if (
    !canAccessStaticPreview(project, {
      userId: session?.user.id ?? null,
      isAdmin,
    })
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

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
    // Storage missing keys often return HTTP 400 + JSON `{ statusCode: "404" }` (body present on GET and HEAD).
    const errBody = await upstream.text().catch(() => "");
    const status = mapStorageUpstreamStatus(upstream.status, errBody);
    return new NextResponse(status === 404 ? "Not found" : upstream.statusText || "Upstream error", {
      status,
    });
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

  if (
    shouldInjectDesignModeBridge(rel, contentType)
  ) {
    const html = await upstream.text();
    // Root-absolute path (not request.url origin): behind nginx, req.url is often
    // http://127.0.0.1:3000 — injecting that as script src breaks HTTPS pages
    // (mixed content) and leaves a dead data-open-ox-design-bridge tag that blocks retries.
    const body = injectDesignModeBridgeIntoHtml(html, designModeBridgeScriptPath());
    headers.set("Content-Length", String(Buffer.byteLength(body, "utf8")));
    return new NextResponse(body, { status: 200, headers });
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}

type Ctx = { params: Promise<{ projectId: string; path?: string[] }> };

/**
 * Do NOT 307-redirect `/site-previews/id` → `/site-previews/id/`.
 * Next.js defaults to `trailingSlash: false`, which redirects the slash URL back to the no-slash
 * URL — combined with the above you get ERR_TOO_MANY_REDIRECTS. Serve `index.html` for both shapes.
 */

export async function GET(req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return new NextResponse("Missing projectId", { status: 400 });
  }
  const denied = await assertStaticPreviewAccess(id, req);
  if (denied) return denied;
  const segments = normalizePreviewPathSegments(path);
  if (!isSafePreviewSegments(segments)) {
    return new NextResponse("Invalid path", { status: 400 });
  }
  const rel = segments.length ? segments.join("/") : "index.html";
  return proxyFromStorage(id, rel, "GET");
}

export async function HEAD(req: Request, ctx: Ctx) {
  const { projectId, path } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return new NextResponse(null, { status: 400 });
  }
  const denied = await assertStaticPreviewAccess(id, req);
  if (denied) {
    return new NextResponse(null, { status: denied.status });
  }
  const segments = normalizePreviewPathSegments(path);
  if (!isSafePreviewSegments(segments)) {
    return new NextResponse(null, { status: 400 });
  }
  const rel = segments.length ? segments.join("/") : "index.html";
  return proxyFromStorage(id, rel, "HEAD");
}
