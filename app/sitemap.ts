import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { withLocalePrefix } from "@/lib/i18n/localePath";
import { COMPETITORS } from "@/lib/seo/competitors";
import { absoluteLocaleUrl, getSiteOrigin } from "@/lib/seo/siteUrl";

const INDEXED_PATHS = [
  "/",
  "/pricing",
  "/changelog",
  "/compare",
  "/alternatives",
  ...COMPETITORS.map((c) => `/compare/${c.slug}`),
] as const;

function localeAlternates(pathname: string): MetadataRoute.Sitemap[number]["alternates"] {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteLocaleUrl(pathname, locale);
  }
  return { languages };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  const entries: MetadataRoute.Sitemap = [];

  for (const pathname of INDEXED_PATHS) {
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
        alternates: localeAlternates(pathname),
      });
    }
  }

  return entries;
}
