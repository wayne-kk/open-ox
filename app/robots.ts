import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/seo/siteUrl";

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

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
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
    sitemap: `${origin}/sitemap.xml`,
  };
}
