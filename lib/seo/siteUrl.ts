import { routing } from "@/i18n/routing";
import { withLocalePrefix } from "@/lib/i18n/localePath";

/** Canonical site origin for metadata / sitemap (no trailing slash). */
export function getSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Absolute URL for a locale-aware pathname (e.g. `/pricing` → `https://…/en/pricing`). */
export function absoluteLocaleUrl(pathname: string, locale: string): string {
  const path = withLocalePrefix(pathname || "/", locale);
  if (path === "/") return getSiteOrigin();
  return `${getSiteOrigin()}${path}`;
}

/** hreflang map for a marketing pathname shared across locales. */
export function languageAlternates(pathname: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteLocaleUrl(pathname, locale);
  }
  languages["x-default"] = absoluteLocaleUrl(pathname, routing.defaultLocale);
  return languages;
}
