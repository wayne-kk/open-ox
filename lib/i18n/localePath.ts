import { routing } from "@/i18n/routing";

/** Strip a leading locale segment (`/en/...` or `/zh-CN/...`) for auth matching. */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || "/";
    }
  }
  return pathname;
}

export function localeFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

export function withLocalePrefix(pathname: string, locale: string): string {
  if (locale === routing.defaultLocale) return pathname || "/";
  if (pathname === "/") return `/${locale}`;
  return `/${locale}${pathname}`;
}
