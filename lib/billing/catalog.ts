/**
 * Public pricing catalog. Stripe Price IDs come from env so test/live can differ.
 */

export type ProTierId = "pro_100" | "pro_200" | "pro_400";

export type ProTier = {
  id: ProTierId;
  name: string;
  monthlyCredits: number;
  /** Display USD / month (marketing). */
  priceUsd: number;
  /** Env var holding Stripe Price ID for this subscription. */
  priceEnvKey: string;
  highlight?: boolean;
};

export type TopUpPackId = "topup_50" | "topup_100" | "topup_200";

export type TopUpPack = {
  id: TopUpPackId;
  name: string;
  credits: number;
  priceUsd: number;
  priceEnvKey: string;
};

export const PRO_TIERS: ProTier[] = [
  {
    id: "pro_100",
    name: "Pro 100",
    monthlyCredits: 100,
    priceUsd: 25,
    priceEnvKey: "STRIPE_PRICE_PRO_100",
  },
  {
    id: "pro_200",
    name: "Pro 200",
    monthlyCredits: 200,
    priceUsd: 50,
    priceEnvKey: "STRIPE_PRICE_PRO_200",
    highlight: true,
  },
  {
    id: "pro_400",
    name: "Pro 400",
    monthlyCredits: 400,
    priceUsd: 100,
    priceEnvKey: "STRIPE_PRICE_PRO_400",
  },
];

export const TOPUP_PACKS: TopUpPack[] = [
  {
    id: "topup_50",
    name: "50 credits",
    credits: 50,
    priceUsd: 15,
    priceEnvKey: "STRIPE_PRICE_TOPUP_50",
  },
  {
    id: "topup_100",
    name: "100 credits",
    credits: 100,
    priceUsd: 28,
    priceEnvKey: "STRIPE_PRICE_TOPUP_100",
  },
  {
    id: "topup_200",
    name: "200 credits",
    credits: 200,
    priceUsd: 50,
    priceEnvKey: "STRIPE_PRICE_TOPUP_200",
  },
];

export function getProTier(id: string): ProTier | undefined {
  return PRO_TIERS.find((t) => t.id === id);
}

export function getTopUpPack(id: string): TopUpPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}

export function resolveStripePriceId(envKey: string): string | null {
  const v = process.env[envKey]?.trim();
  return v || null;
}

/** Map Stripe Price ID → catalog entry (subscription or top-up). */
export function lookupByStripePriceId(priceId: string): {
  kind: "subscription" | "topup";
  tier?: ProTier;
  pack?: TopUpPack;
} | null {
  for (const tier of PRO_TIERS) {
    const id = resolveStripePriceId(tier.priceEnvKey);
    if (id && id === priceId) return { kind: "subscription", tier };
  }
  for (const pack of TOPUP_PACKS) {
    const id = resolveStripePriceId(pack.priceEnvKey);
    if (id && id === priceId) return { kind: "topup", pack };
  }
  return null;
}

export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function catalogForClient() {
  return {
    pro: PRO_TIERS.map((t) => ({
      id: t.id,
      name: t.name,
      monthlyCredits: t.monthlyCredits,
      priceUsd: t.priceUsd,
      highlight: Boolean(t.highlight),
      available: Boolean(resolveStripePriceId(t.priceEnvKey)),
    })),
    topups: TOPUP_PACKS.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      priceUsd: p.priceUsd,
      available: Boolean(resolveStripePriceId(p.priceEnvKey)),
    })),
    stripeConfigured: isStripeBillingConfigured(),
  };
}
