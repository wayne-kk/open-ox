import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  absoluteLocaleUrl,
  getSiteOrigin,
  languageAlternates,
} from "@/lib/seo/siteUrl";

const OG_IMAGE_PATH = "/og/default.png";

type MarketingSeoKey = "home" | "pricing" | "changelog" | "compare" | "compareLovable" | "compareV0" | "compareBase44" | "alternatives";

type BuildOpts = {
  locale: string;
  /** Pathname without locale prefix, e.g. `/` or `/pricing`. */
  pathname: string;
  seoKey: MarketingSeoKey;
  /**
   * When set, `canonical` points here instead of `pathname`
   * (e.g. `/home` → `/`).
   */
  canonicalPathname?: string;
  /** Extra robots directives (e.g. noindex for `/home`). */
  robots?: Metadata["robots"];
};

export async function buildMarketingMetadata({
  locale,
  pathname,
  seoKey,
  canonicalPathname,
  robots,
}: BuildOpts): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  const title = t(`${seoKey}.title`);
  const description = t(`${seoKey}.description`);
  const canonicalPath = canonicalPathname ?? pathname;
  const canonical = absoluteLocaleUrl(canonicalPath, locale);
  const languages = languageAlternates(canonicalPath);
  const ogImage = `${getSiteOrigin()}${OG_IMAGE_PATH}`;
  const ogLocale = locale === "zh-CN" ? "zh_CN" : "en_US";
  const alternateLocale = locale === "zh-CN" ? "en_US" : "zh_CN";

  return {
    title,
    description,
    robots,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: "website",
      locale: ogLocale,
      alternateLocale: [alternateLocale],
      url: canonical,
      siteName: "Open-OX",
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: "Open-OX" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
