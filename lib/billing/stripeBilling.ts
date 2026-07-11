import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, getAppUrl } from "./stripeClient";
import {
  getProTier,
  getTopUpPack,
  lookupByStripePriceId,
  resolveStripePriceId,
  type ProTierId,
  type TopUpPackId,
} from "./catalog";
import { claimStripeEvent, grantCredits } from "./grants";
import { utcMonthKey } from "./credits";

function adminDb(): SupabaseClient {
  return createSupabaseServiceRoleClient();
}

async function getAccountByUserId(userId: string) {
  const admin = adminDb();
  const { data, error } = await admin
    .from("user_credit_accounts")
    .select(
      "user_id, balance, plan, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, pro_tier, last_monthly_grant_key"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getAccountByCustomerId(customerId: string) {
  const admin = adminDb();
  const { data, error } = await admin
    .from("user_credit_accounts")
    .select(
      "user_id, balance, plan, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, pro_tier, last_monthly_grant_key"
    )
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function ensureStripeCustomer(userId: string, email?: string | null): Promise<string> {
  const admin = adminDb();
  const existing = await getAccountByUserId(userId);
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  if (!existing) {
    await admin.from("user_credit_accounts").insert({
      user_id: userId,
      balance: 0,
      plan: "free",
    });
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { openOxUserId: userId },
  });

  const { error } = await admin
    .from("user_credit_accounts")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return customer.id;
}

export async function createSubscriptionCheckout(params: {
  userId: string;
  email?: string | null;
  tierId: ProTierId;
}): Promise<{ url: string }> {
  const tier = getProTier(params.tierId);
  if (!tier) throw new Error("Unknown Pro tier");
  const priceId = resolveStripePriceId(tier.priceEnvKey);
  if (!priceId) throw new Error(`Missing ${tier.priceEnvKey}`);

  const customerId = await ensureStripeCustomer(params.userId, params.email);
  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing?checkout=cancel`,
    client_reference_id: params.userId,
    metadata: {
      openOxUserId: params.userId,
      openOxKind: "subscription",
      openOxTierId: tier.id,
    },
    subscription_data: {
      metadata: {
        openOxUserId: params.userId,
        openOxTierId: tier.id,
      },
    },
  });

  if (!session.url) throw new Error("Stripe Checkout did not return a URL");
  return { url: session.url };
}

export async function createTopUpCheckout(params: {
  userId: string;
  email?: string | null;
  packId: TopUpPackId;
}): Promise<{ url: string }> {
  const pack = getTopUpPack(params.packId);
  if (!pack) throw new Error("Unknown top-up pack");
  const priceId = resolveStripePriceId(pack.priceEnvKey);
  if (!priceId) throw new Error(`Missing ${pack.priceEnvKey}`);

  const customerId = await ensureStripeCustomer(params.userId, params.email);
  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?checkout=success&topup=1`,
    cancel_url: `${appUrl}/pricing?checkout=cancel`,
    client_reference_id: params.userId,
    metadata: {
      openOxUserId: params.userId,
      openOxKind: "topup",
      openOxPackId: pack.id,
      openOxCredits: String(pack.credits),
    },
  });

  if (!session.url) throw new Error("Stripe Checkout did not return a URL");
  return { url: session.url };
}

export async function createBillingPortalSession(userId: string): Promise<{ url: string }> {
  const account = await getAccountByUserId(userId);
  if (!account?.stripe_customer_id) {
    throw new Error("No Stripe customer — subscribe first");
  }
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id as string,
    return_url: `${getAppUrl()}/pricing`,
  });
  return { url: session.url };
}

async function applyProSubscription(params: {
  userId: string;
  tierId: ProTierId;
  subscriptionId: string;
  status: string;
  idempotencyKey: string;
  grantCreditsNow: boolean;
}) {
  const tier = getProTier(params.tierId);
  if (!tier) throw new Error(`Unknown tier ${params.tierId}`);
  const admin = adminDb();
  const monthKey = utcMonthKey();

  await admin
    .from("user_credit_accounts")
    .update({
      plan: "pro",
      pro_tier: tier.id,
      stripe_subscription_id: params.subscriptionId,
      stripe_subscription_status: params.status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId);

  if (!params.grantCreditsNow) return;

  const account = await getAccountByUserId(params.userId);
  if (account?.last_monthly_grant_key === `${params.subscriptionId}:${monthKey}`) {
    return;
  }

  await grantCredits(admin, {
    userId: params.userId,
    amount: tier.monthlyCredits,
    kind: "grant_monthly",
    reason: `Pro ${tier.name} monthly credits`,
    idempotencyKey: params.idempotencyKey,
    metadata: { tierId: tier.id, subscriptionId: params.subscriptionId, monthKey },
    accountPatch: {
      plan: "pro",
      pro_tier: tier.id,
      last_monthly_grant_key: `${params.subscriptionId}:${monthKey}`,
      stripe_subscription_id: params.subscriptionId,
      stripe_subscription_status: params.status,
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.openOxUserId ||
    session.client_reference_id ||
    null;
  if (!userId) {
    console.warn("[stripe] checkout.session.completed missing user id");
    return;
  }

  const kind = session.metadata?.openOxKind;
  if (kind === "topup" || session.mode === "payment") {
    const packId = (session.metadata?.openOxPackId || "") as TopUpPackId;
    const pack = getTopUpPack(packId);
    const credits = pack?.credits ?? Number(session.metadata?.openOxCredits || 0);
    if (!credits) {
      console.warn("[stripe] top-up checkout missing credits");
      return;
    }
    await grantCredits(undefined, {
      userId,
      amount: credits,
      kind: "grant_topup",
      reason: pack ? `Top-up ${pack.name}` : "Credit top-up",
      idempotencyKey: `checkout:${session.id}`,
      metadata: { sessionId: session.id, packId },
    });
    return;
  }

  if (session.mode === "subscription") {
    const tierId = (session.metadata?.openOxTierId || "pro_100") as ProTierId;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subId) {
      console.warn("[stripe] subscription checkout missing subscription id");
      return;
    }
    await applyProSubscription({
      userId,
      tierId,
      subscriptionId: subId,
      status: "active",
      idempotencyKey: `checkout_sub:${session.id}`,
      grantCreditsNow: true,
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  // Only renewals / subscription invoices — one-time payments use checkout.session.completed.
  const billingReason = (invoice as { billing_reason?: string | null }).billing_reason;
  if (billingReason === "manual") return;

  const account = await getAccountByCustomerId(customerId);
  if (!account) {
    console.warn("[stripe] invoice.paid unknown customer", customerId);
    return;
  }

  const inv = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
    lines?: { data?: Array<{ price?: { id?: string } | null }> };
  };

  let tierId = (account.pro_tier as ProTierId | null) || null;
  const priceId = inv.lines?.data?.[0]?.price?.id;
  if (priceId) {
    const hit = lookupByStripePriceId(priceId);
    if (hit?.tier) tierId = hit.tier.id;
  }
  if (!tierId) tierId = "pro_100";

  const subRaw = inv.subscription;
  const subId =
    (typeof subRaw === "string" ? subRaw : subRaw?.id) ||
    (account.stripe_subscription_id as string | null);
  if (!subId) return;

  await applyProSubscription({
    userId: account.user_id as string,
    tierId,
    subscriptionId: subId,
    status: "active",
    idempotencyKey: `invoice:${invoice.id}`,
    grantCreditsNow: true,
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.openOxUserId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const account = userId
    ? await getAccountByUserId(userId)
    : customerId
      ? await getAccountByCustomerId(customerId)
      : null;
  if (!account) return;

  const priceId = sub.items.data[0]?.price?.id;
  const hit = priceId ? lookupByStripePriceId(priceId) : null;
  const tierId =
    (sub.metadata?.openOxTierId as ProTierId | undefined) ||
    hit?.tier?.id ||
    (account.pro_tier as ProTierId | null) ||
    "pro_100";

  const admin = adminDb();
  const active = sub.status === "active" || sub.status === "trialing";

  await admin
    .from("user_credit_accounts")
    .update({
      plan: active ? "pro" : "free",
      pro_tier: active ? tierId : null,
      stripe_subscription_id: sub.id,
      stripe_subscription_status: sub.status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", account.user_id);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const userId = sub.metadata?.openOxUserId;
  const account = userId
    ? await getAccountByUserId(userId)
    : customerId
      ? await getAccountByCustomerId(customerId)
      : null;
  if (!account) return;

  const admin = adminDb();
  // Preserve remaining balance; mark today so Free daily replace waits until next UTC day.
  const today = new Date().toISOString().slice(0, 10);
  await admin
    .from("user_credit_accounts")
    .update({
      plan: "free",
      pro_tier: null,
      stripe_subscription_id: null,
      stripe_subscription_status: "canceled",
      last_daily_grant_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", account.user_id);
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  const claimed = await claimStripeEvent(event.id, event.type);
  if (!claimed) {
    console.info("[stripe] duplicate event", event.id, event.type);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}
