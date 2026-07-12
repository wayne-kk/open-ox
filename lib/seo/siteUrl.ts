import { routing } from "@/i18n/routing";
import { withLocalePrefix } from "@/lib/i18n/localePath";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    );
  } catch {
    return true;
  }
}

function originFromRaw(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * Canonical site origin (no trailing slash).
 * Prefer `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`.
 * Never silently ship localhost URLs in production builds — Search Consoles reject them.
 */
export function getSiteOrigin(): string {
  const fromEnv =
    originFromRaw(process.env.NEXT_PUBLIC_SITE_URL) ||
    originFromRaw(process.env.NEXT_PUBLIC_APP_URL);

  if (fromEnv && !isLocalhostOrigin(fromEnv)) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[seo] NEXT_PUBLIC_SITE_URL must be your public https origin in production " +
        "(sitemap/canonicals cannot be localhost). Falling back would break Search Console."
    );
  }

  return fromEnv || "http://localhost:3000";
}

/** True when the configured / resolved origin is not usable for public SEO. */
export function isSeoOriginLocal(origin: string = getSiteOrigin()): boolean {
  return isLocalhostOrigin(origin);
}

/**
 * Prefer env public origin; if unset/localhost, use the incoming request Host
 * (so a mis-baked localhost build still serves a usable sitemap on the real domain).
 */
export async function resolvePublicOrigin(): Promise<string> {
  const fromEnv = getSiteOrigin();
  if (!isLocalhostOrigin(fromEnv)) return fromEnv;

  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host =
      h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      h.get("host")?.split(",")[0]?.trim() ||
      "";
    const proto =
      h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    if (host) {
      const origin = `${proto}://${host}`;
      if (!isLocalhostOrigin(origin)) return origin;
    }
  } catch {
    /* headers() unavailable outside request (e.g. some build paths) */
  }

  return fromEnv;
}

/** Absolute URL for a locale-aware pathname (e.g. `/pricing` → `https://…/en/pricing`). */
export function absoluteLocaleUrl(
  pathname: string,
  locale: string,
  origin: string = getSiteOrigin()
): string {
  const path = withLocalePrefix(pathname || "/", locale);
  if (path === "/") return origin;
  return `${origin}${path}`;
}

/** hreflang map for a marketing pathname shared across locales. */
export function languageAlternates(
  pathname: string,
  origin: string = getSiteOrigin()
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteLocaleUrl(pathname, locale, origin);
  }
  languages["x-default"] = absoluteLocaleUrl(pathname, routing.defaultLocale, origin);
  return languages;
}
