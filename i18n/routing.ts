import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh-CN", "en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // The global root is English; language changes happen only through the explicit switcher.
  localeDetection: false,
  // Next Metadata owns canonical-aware hreflang tags for indexed marketing pages.
  alternateLinks: false,
});

export type AppLocale = (typeof routing.locales)[number];
