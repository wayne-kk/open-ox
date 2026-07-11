import { describe, expect, it, afterEach } from "vitest";
import {
  getProTier,
  getTopUpPack,
  lookupByStripePriceId,
  catalogForClient,
} from "./catalog";

describe("catalog", () => {
  const keys = [
    "STRIPE_PRICE_PRO_100",
    "STRIPE_PRICE_PRO_200",
    "STRIPE_PRICE_TOPUP_50",
    "STRIPE_SECRET_KEY",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("resolves known tiers and packs", () => {
    expect(getProTier("pro_200")?.monthlyCredits).toBe(200);
    expect(getTopUpPack("topup_50")?.credits).toBe(50);
    expect(getProTier("nope")).toBeUndefined();
  });

  it("maps stripe price ids when env is set", () => {
    for (const k of keys) prev[k] = process.env[k];
    process.env.STRIPE_PRICE_PRO_100 = "price_pro100";
    process.env.STRIPE_PRICE_TOPUP_50 = "price_top50";
    expect(lookupByStripePriceId("price_pro100")?.kind).toBe("subscription");
    expect(lookupByStripePriceId("price_top50")?.kind).toBe("topup");
    expect(lookupByStripePriceId("price_unknown")).toBeNull();
  });

  it("exposes availability in client catalog", () => {
    for (const k of keys) prev[k] = process.env[k];
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_PRO_200 = "price_200";
    delete process.env.STRIPE_PRICE_PRO_100;
    const cat = catalogForClient();
    expect(cat.stripeConfigured).toBe(true);
    expect(cat.pro.find((p) => p.id === "pro_200")?.available).toBe(true);
    expect(cat.pro.find((p) => p.id === "pro_100")?.available).toBe(false);
  });
});
