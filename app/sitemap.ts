import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { withLocalePrefix } from "@/lib/i18n/localePath";
import { COMPETITORS } from "@/lib/seo/competitors";
import {
  absoluteLocaleUrl,
  isSeoOriginLocal,
  resolvePublicOrigin,
} from "@/lib/seo/siteUrl";

const INDEXED_PATHS = [
  "/",
  "/pricing",
  "/changelog",
  "/compare",
  "/alternatives",
  ...COMPETITORS.map((c) => `/compare/${c.slug}`),
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await resolvePublicOrigin();

  // Baidu / Google reject localhost (and private) URLs in a submitted sitemap.
  if (isSeoOriginLocal(origin)) {
    console.error(
      "[sitemap] Refusing to emit localhost URLs. Set NEXT_PUBLIC_SITE_URL to your public https origin, rebuild, then submit https://YOUR_DOMAIN/sitemap.xml"
    );
    return [];
  }

  const entries: MetadataRoute.Sitemap = [];

  for (const pathname of INDEXED_PATHS) {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) {
      languages[locale] = absoluteLocaleUrl(pathname, locale, origin);
    }

    for (const locale of routing.locales) {
      const path = withLocalePrefix(pathname, locale);
      entries.push({
        url: path === "/" ? origin : `${origin}${path}`,
        lastModified: new Date(),
        changeFrequency: pathname === "/" ? "weekly" : "monthly",
        priority:
          pathname === "/"
            ? 1
            : pathname.startsWith("/compare") || pathname === "/alternatives"
              ? 0.7
              : 0.8,
        alternates: { languages },
      });
    }
  }

  return entries;
}
