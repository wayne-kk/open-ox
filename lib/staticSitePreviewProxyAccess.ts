/**
 * Fast ACL for `/site-previews` proxy: lean project row, short TTL cache,
 * publishPreview short-circuit, and entry grant cookie so subsequent assets
 * skip session/admin DB round-trips.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canAccessStaticPreview } from "@/lib/auth/projectAccess";
import {
  PREVIEW_CAPTURE_SECRET_HEADER,
  previewCaptureSecretMatches,
} from "@/lib/previewCaptureAuth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const PREVIEW_ACCESS_GRANT_COOKIE = "ox_sp_grant";

/** How long a lean ACL row stays in process memory. */
export const PREVIEW_ACCESS_ROW_TTL_MS = 30_000;

/** Grant cookie lifetime — covers iframe asset waterfall + short browsing. */
export const PREVIEW_ACCESS_GRANT_TTL_SEC = 15 * 60;

export type StaticPreviewAccessRow = {
  id: string;
  ownerUserId: string | null;
  publishPreview: boolean;
};

type CachedRow = {
  row: StaticPreviewAccessRow | null;
  expiresAt: number;
};

const rowCache = new Map<string, CachedRow>();

/** Test / diagnostics — clear process-local ACL cache. */
export function clearStaticPreviewAccessRowCache(): void {
  rowCache.clear();
}

function getGrantSigningSecret(): string | null {
  const capture = process.env.OPEN_OX_PREVIEW_CAPTURE_SECRET?.trim();
  if (capture) return capture;
  const role = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return role || null;
}

export function mintPreviewAccessGrant(
  projectId: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): string | null {
  const secret = getGrantSigningSecret();
  if (!secret) return null;
  const exp = nowSec + PREVIEW_ACCESS_GRANT_TTL_SEC;
  const payload = `v1.${projectId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPreviewAccessGrant(
  projectId: string,
  token: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!token) return false;
  const secret = getGrantSigningSecret();
  if (!secret) return false;
  const parts = token.split(".");
  // v1 . projectId . exp . sig  — projectId may contain dots (timestamp ids do not, but be safe)
  if (parts.length < 4) return false;
  if (parts[0] !== "v1") return false;
  const sig = parts[parts.length - 1]!;
  const expRaw = parts[parts.length - 2]!;
  const id = parts.slice(1, -2).join(".");
  if (id !== projectId) return false;
  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp < nowSec) return false;
  const payload = `v1.${id}.${exp}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function readPreviewAccessGrantFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name !== PREVIEW_ACCESS_GRANT_COOKIE) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function previewAccessGrantSetCookieHeader(
  projectId: string,
  token: string
): string {
  const path = `/site-previews/${encodeURIComponent(projectId)}`;
  const parts = [
    `${PREVIEW_ACCESS_GRANT_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${path}`,
    `Max-Age=${PREVIEW_ACCESS_GRANT_TTL_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

type LeanRow = {
  id: string;
  user_id: string | null;
  publish_preview: boolean | null;
};

export async function loadStaticPreviewAccessRow(
  projectId: string,
  options?: {
    db?: SupabaseClient;
    nowMs?: number;
    bypassCache?: boolean;
  }
): Promise<StaticPreviewAccessRow | null> {
  const nowMs = options?.nowMs ?? Date.now();
  if (!options?.bypassCache) {
    const hit = rowCache.get(projectId);
    if (hit && hit.expiresAt > nowMs) {
      return hit.row;
    }
  }

  let db = options?.db;
  if (!db) {
    try {
      db = createSupabaseServiceRoleClient();
    } catch {
      return null;
    }
  }

  const { data, error } = await db
    .from("projects")
    .select("id, user_id, publish_preview")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    rowCache.set(projectId, { row: null, expiresAt: nowMs + PREVIEW_ACCESS_ROW_TTL_MS });
    return null;
  }

  const lean = data as LeanRow;
  const row: StaticPreviewAccessRow = {
    id: lean.id,
    ownerUserId: lean.user_id,
    publishPreview: lean.publish_preview === true,
  };
  rowCache.set(projectId, { row, expiresAt: nowMs + PREVIEW_ACCESS_ROW_TTL_MS });
  return row;
}

export type StaticPreviewAccessResult =
  | { status: "ok"; setGrantCookie?: string }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "misconfigured" };

/**
 * Resolve whether the request may fetch preview bytes.
 * Order: capture secret → grant cookie → lean row (+ publishPreview) → session/owner/admin.
 */
export async function resolveStaticPreviewAccess(params: {
  projectId: string;
  request: Request;
  getSessionUser: () => Promise<{
    user: { id: string };
    supabase: SupabaseClient;
  } | null>;
  isAdminUser: (args: {
    supabase: SupabaseClient;
    userId: string;
  }) => Promise<boolean>;
  nowSec?: number;
  nowMs?: number;
  db?: SupabaseClient;
}): Promise<StaticPreviewAccessResult> {
  const {
    projectId,
    request,
    getSessionUser,
    isAdminUser,
    nowSec = Math.floor(Date.now() / 1000),
    nowMs = Date.now(),
    db,
  } = params;

  const captureSecret = request.headers.get(PREVIEW_CAPTURE_SECRET_HEADER);
  if (previewCaptureSecretMatches(captureSecret)) {
    return { status: "ok" };
  }

  const grant = readPreviewAccessGrantFromCookieHeader(request.headers.get("cookie"));
  if (verifyPreviewAccessGrant(projectId, grant, nowSec)) {
    return { status: "ok" };
  }

  const row = await loadStaticPreviewAccessRow(projectId, { db, nowMs });
  if (!row) {
    // Distinguish misconfigured service role (no client) from missing project:
    // load returns null for both; try creating client once more for misconfig signal.
    try {
      createSupabaseServiceRoleClient();
    } catch {
      return { status: "misconfigured" };
    }
    return { status: "not_found" };
  }

  if (
    canAccessStaticPreview(
      { ownerUserId: row.ownerUserId ?? undefined, publishPreview: row.publishPreview },
      { userId: null, isAdmin: false }
    )
  ) {
    const token = mintPreviewAccessGrant(projectId, nowSec);
    return token
      ? { status: "ok", setGrantCookie: previewAccessGrantSetCookieHeader(projectId, token) }
      : { status: "ok" };
  }

  const session = await getSessionUser();
  if (!session) {
    return { status: "forbidden" };
  }

  const isAdmin = await isAdminUser({
    supabase: session.supabase,
    userId: session.user.id,
  });

  if (
    !canAccessStaticPreview(
      { ownerUserId: row.ownerUserId ?? undefined, publishPreview: row.publishPreview },
      { userId: session.user.id, isAdmin }
    )
  ) {
    return { status: "forbidden" };
  }

  const token = mintPreviewAccessGrant(projectId, nowSec);
  return token
    ? { status: "ok", setGrantCookie: previewAccessGrantSetCookieHeader(projectId, token) }
    : { status: "ok" };
}
