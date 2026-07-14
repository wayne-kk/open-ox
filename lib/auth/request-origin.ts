import type { NextRequest } from "next/server";

function originFromUrlString(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Public origin for OAuth redirect_uri and post-login redirects.
 * Behind reverse proxies, `request.url` often still points at localhost — use env or forwarded headers first.
 */
export function getPublicOrigin(request: NextRequest): string {
  const fromEnv = originFromUrlString(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (fromEnv) return fromEnv;

  const fromApp = originFromUrlString(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (fromApp) return fromApp;

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

/**
 * Origin for links shown inside Feishu (phone clients cannot open localhost).
 * Prefer the request's public host (e.g. ngrok) when SITE_URL is loopback.
 */
export function getBotFacingOrigin(request: Request): string {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    "";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `${proto}://${host}`;
  }

  const fromEnv = originFromUrlString(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (fromEnv && !isLoopbackOrigin(fromEnv)) return fromEnv;

  const fromApp = originFromUrlString(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (fromApp && !isLoopbackOrigin(fromApp)) return fromApp;

  if (fromEnv) return fromEnv;
  if (fromApp) return fromApp;
  return "http://localhost:3000";
}
