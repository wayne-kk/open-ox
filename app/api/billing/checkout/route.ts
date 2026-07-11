/**
 * POST /api/billing/checkout
 * Body: { kind: "subscription", tierId } | { kind: "topup", packId }
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isStripeBillingConfigured, getProTier, getTopUpPack } from "@/lib/billing/catalog";
import {
  createSubscriptionCheckout,
  createTopUpCheckout,
} from "@/lib/billing/stripeBilling";
import type { ProTierId, TopUpPackId } from "@/lib/billing/catalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured", code: "STRIPE_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: { kind?: string; tierId?: string; packId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, { status: 400 });
  }

  const email = session.user.email;

  try {
    if (body.kind === "subscription") {
      const tierId = body.tierId as ProTierId;
      if (!getProTier(tierId)) {
        return NextResponse.json({ error: "Unknown tier", code: "BAD_REQUEST" }, { status: 400 });
      }
      const { url } = await createSubscriptionCheckout({
        userId: session.user.id,
        email,
        tierId,
      });
      return NextResponse.json({ url });
    }

    if (body.kind === "topup") {
      const packId = body.packId as TopUpPackId;
      if (!getTopUpPack(packId)) {
        return NextResponse.json({ error: "Unknown pack", code: "BAD_REQUEST" }, { status: 400 });
      }
      const { url } = await createTopUpCheckout({
        userId: session.user.id,
        email,
        packId,
      });
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: "Invalid kind", code: "BAD_REQUEST" }, { status: 400 });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed", code: "CHECKOUT_FAILED" },
      { status: 500 }
    );
  }
}
