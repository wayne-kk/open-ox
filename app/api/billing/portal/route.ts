/**
 * POST /api/billing/portal — Stripe Customer Portal
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isStripeBillingConfigured } from "@/lib/billing/catalog";
import { createBillingPortalSession } from "@/lib/billing/stripeBilling";

export const runtime = "nodejs";

export async function POST() {
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

  try {
    const { url } = await createBillingPortalSession(session.user.id);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/portal]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Portal failed",
        code: "PORTAL_FAILED",
      },
      { status: 400 }
    );
  }
}
