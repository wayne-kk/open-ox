import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-CN", "en"],
  defaultLocale: "zh-CN",
  localePrefix: "as-needed",
  // First visit stays default zh-CN; cookie only after explicit switch (no Accept-Language).
  localeDetection: false,
  // Next Metadata owns canonical-aware hreflang tags for indexed marketing pages.
  alternateLinks: false,
});

export type AppLocale = (typeof routing.locales)[number];
