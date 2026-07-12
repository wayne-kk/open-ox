import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { withLocalePrefix } from "@/lib/i18n/localePath";
import { getSiteOrigin } from "@/lib/seo/siteUrl";

const INDEXED_PATHS = ["/", "/pricing", "/changelog"] as const;

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
        priority: pathname === "/" ? 1 : 0.8,
      });
    }
  }

  return entries;
}
