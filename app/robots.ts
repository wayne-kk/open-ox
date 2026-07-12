import type { MetadataRoute } from "next";
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
  const disallow = [
    ...PRIVATE_PREFIXES,
    ...PRIVATE_PREFIXES.map((p) => `/en${p}`),
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
