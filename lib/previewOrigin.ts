/**
 * Dedicated static-preview origin (Form 1).
 *
 * When `NEXT_PUBLIC_PREVIEW_ORIGIN` is set to a **different host** than
 * `NEXT_PUBLIC_SITE_URL`, Studio/community iframes load:
 *   `{PREVIEW_ORIGIN}/{url-encoded projectId}`
 * and `next.config` + `proxy.ts` rewrite that host to `/site-previews/...`.
 *
 * When unset (or same host), keep legacy same-origin
 *   `{SITE_URL}/site-previews/{projectId}`.
 */

export const PREVIEW_ACCESS_GRANT_QUERY = "ox_grant";

type EnvSource = Record<string, string | undefined>;

function envTrim(name: string, env?: EnvSource): string | undefined {
  const v = (env ?? process.env)[name]?.trim();
  return v ? v : undefined;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** App / Studio origin. */
export function getSiteOrigin(env?: EnvSource): string | undefined {
  const raw =
    envTrim("NEXT_PUBLIC_SITE_URL", env) || envTrim("NEXT_PUBLIC_APP_URL", env);
  return raw ? stripTrailingSlash(raw) : undefined;
}

/**
 * Public origin for Storage preview iframes.
 * Prefers `NEXT_PUBLIC_PREVIEW_ORIGIN`, else site origin.
 */
export function getPreviewPublicOrigin(env?: EnvSource): string | undefined {
  const preview = envTrim("NEXT_PUBLIC_PREVIEW_ORIGIN", env);
  if (preview) return stripTrailingSlash(preview);
  return getSiteOrigin(env);
}

export function getPreviewPublicHostname(env?: EnvSource): string | undefined {
  const origin = getPreviewPublicOrigin(env);
  if (!origin) return undefined;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function getSiteHostname(env?: EnvSource): string | undefined {
  const origin = getSiteOrigin(env);
  if (!origin) return undefined;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** True when preview is served on a host distinct from the Studio app. */
export function isDedicatedPreviewOrigin(env?: EnvSource): boolean {
  const previewHost = getPreviewPublicHostname(env);
  const siteHost = getSiteHostname(env);
  if (!previewHost || !siteHost) return false;
  return previewHost !== siteHost;
}

/**
 * Path prefix for the preview export `basePath` and public URL path
 * (leading slash, no trailing slash).
 */
export function getStoragePreviewBasePath(projectId: string, env?: EnvSource): string {
  const id = encodeURIComponent(projectId);
  if (isDedicatedPreviewOrigin(env)) {
    return `/${id}`;
  }
  return `/site-previews/${id}`;
}

/**
 * Cookie Path for the entry grant. On dedicated origin the public path is `/{id}`;
 * on legacy same-origin it remains `/site-previews/{id}`.
 */
export function previewAccessGrantCookiePath(projectId: string, env?: EnvSource): string {
  return getStoragePreviewBasePath(projectId, env);
}

/** Browser entry URL (no trailing slash, no grant query). */
export function buildStaticPreviewUrl(projectId: string, env?: EnvSource): string {
  const origin = getPreviewPublicOrigin(env);
  if (!origin) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_PREVIEW_ORIGIN) is required for storage preview URLs"
    );
  }
  return `${origin}${getStoragePreviewBasePath(projectId, env)}`;
}

/** Attach one-time grant for cross-origin private iframe bootstrap. */
export function withPreviewAccessGrantQuery(previewUrl: string, grantToken: string): string {
  const u = new URL(previewUrl);
  u.searchParams.set(PREVIEW_ACCESS_GRANT_QUERY, grantToken);
  return u.toString();
}

export function readPreviewAccessGrantFromUrl(url: string | URL): string | null {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const g = u.searchParams.get(PREVIEW_ACCESS_GRANT_QUERY)?.trim();
    return g || null;
  } catch {
    return null;
  }
}

/**
 * Hostname from a request (no port). Prefers `Host` / `X-Forwarded-Host` because
 * some Next proxy paths leave `nextUrl.hostname` as the listen host (`localhost`)
 * even when the browser asked for `p.localhost`.
 */
export function hostnameFromHostHeader(
  hostHeader: string | null | undefined,
  fallbackHostname?: string
): string {
  const raw = hostHeader?.split(",")[0]?.trim() ?? "";
  if (raw) {
    // strip port; keep IPv6 bracket form untouched (preview hosts are names)
    if (raw.startsWith("[")) {
      const end = raw.indexOf("]");
      return (end >= 0 ? raw.slice(1, end) : raw).toLowerCase();
    }
    return raw.split(":")[0]!.toLowerCase();
  }
  return (fallbackHostname ?? "").toLowerCase();
}

/**
 * Whether `host` (hostname, no port) is the dedicated preview host.
 * Compares hostname only — port may differ in local `p.localhost:3000` setups.
 */
export function isPreviewHostRequest(hostname: string, env?: EnvSource): boolean {
  if (!isDedicatedPreviewOrigin(env)) return false;
  const expected = getPreviewPublicHostname(env);
  if (!expected) return false;
  const host = hostname.toLowerCase();
  if (host === expected) return true;
  // Dev convenience: PREVIEW_ORIGIN=http://p.localhost:3000 but request Host is `p.localhost`
  // (already equal) — also accept when expected is `p.localhost` and host is that exact name.
  return false;
}

/**
 * Rewrite `/{projectId}` or `/{projectId}/...` → `/site-previews/{projectId}/...`
 * on the dedicated preview host. Returns null when no rewrite applies.
 */
export function rewriteDedicatedPreviewPathname(pathname: string): string | null {
  if (pathname.startsWith("/site-previews/") || pathname === "/site-previews") {
    return null;
  }
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/open-ox") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return null;
  }
  // /{projectId} or /{projectId}/rest
  const match = pathname.match(/^\/([^/]+)(?:\/(.*))?$/);
  if (!match) return null;
  const projectIdSeg = match[1]!;
  const rest = match[2];
  if (!projectIdSeg || projectIdSeg.includes("..")) return null;
  const base = `/site-previews/${projectIdSeg}`;
  return rest != null && rest.length > 0 ? `${base}/${rest}` : base;
}
