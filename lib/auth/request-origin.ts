import type { NextRequest } from "next/server";

/**
 * Public origin for OAuth redirect_uri and post-login redirects.
 * Behind reverse proxies, `request.url` often still points at localhost — use env or forwarded headers first.
 */
export function getPublicOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* fall through */
    }
  }

  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    "";
  if (proto && host) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
