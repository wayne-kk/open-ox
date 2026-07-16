/** Curated example briefs for new-user onboarding (product-owned, i18n via messages). */

export type ExampleBriefId =
  | "local-service"
  | "saas-marketing"
  | "portfolio"
  | "event-landing"
  | "brand-narrative";

export const EXAMPLE_BRIEF_IDS: ExampleBriefId[] = [
  "local-service",
  "saas-marketing",
  "portfolio",
  "event-landing",
  "brand-narrative",
];

/** next-intl message keys under `onboarding.*` for each brief. */
export const EXAMPLE_BRIEF_MESSAGE_KEYS: Record<
  ExampleBriefId,
  { label: string; prompt: string }
> = {
  "local-service": {
    label: "briefLocalServiceLabel",
    prompt: "briefLocalServicePrompt",
  },
  "saas-marketing": {
    label: "briefSaasMarketingLabel",
    prompt: "briefSaasMarketingPrompt",
  },
  portfolio: {
    label: "briefPortfolioLabel",
    prompt: "briefPortfolioPrompt",
  },
  "event-landing": {
    label: "briefEventLandingLabel",
    prompt: "briefEventLandingPrompt",
  },
  "brand-narrative": {
    label: "briefBrandNarrativeLabel",
    prompt: "briefBrandNarrativePrompt",
  },
};
