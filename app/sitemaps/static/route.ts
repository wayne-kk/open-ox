import { routing } from "@/i18n/routing";
import { COMPETITORS } from "@/lib/seo/competitors";
import { absoluteLocaleUrl, languageAlternates, resolvePublicOrigin } from "@/lib/seo/siteUrl";
import { sitemapUrlSetXml, sitemapXmlResponse } from "@/lib/seo/sitemapXml";

const PATHS = [
  "/", "/pricing", "/changelog", "/compare", "/alternatives",
  ...COMPETITORS.map((competitor) => `/compare/${competitor.slug}`),
];

export async function GET() {
  const origin = await resolvePublicOrigin();
  const urls = PATHS.flatMap((pathname) => routing.locales.map((locale) => ({
    loc: absoluteLocaleUrl(pathname, locale, origin),
    changefreq: pathname === "/" ? "weekly" : "monthly",
    priority: pathname === "/" ? 1 : 0.8,
    alternates: languageAlternates(pathname, origin),
  })));
  return sitemapXmlResponse(sitemapUrlSetXml(urls));
}
