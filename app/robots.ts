import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { isSeoOriginLocal, resolvePublicOrigin } from "@/lib/seo/siteUrl";

const PRIVATE_PREFIXES = [
  "/studio",
  "/settings",
  "/dashboard",
  "/api",
  "/admin",
  "/auth",
  "/llm-test",
  "/test-image",
  "/projects",
  "/site-previews",
] as const;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await resolvePublicOrigin();
  const prefixedLocales = routing.locales.filter(
    (locale) => locale !== routing.defaultLocale
  );
  const disallow = [
    ...PRIVATE_PREFIXES,
    ...prefixedLocales.flatMap((locale) =>
      PRIVATE_PREFIXES.map((path) => `/${locale}${path}`)
    ),
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
    ],
    // Only advertise sitemap when it would contain public https URLs.
    ...(isSeoOriginLocal(origin) ? {} : { sitemap: `${origin}/sitemap.xml` }),
  };
}
