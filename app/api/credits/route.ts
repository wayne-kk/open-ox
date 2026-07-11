/**
 * GET /api/credits — current user's credit balance (applies Free daily grant).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCreditBalance } from "@/lib/billing/account";
import {
  FREE_DAILY_CREDITS,
  FREE_MONTHLY_GRANT_CAP,
  isCreditsEnabled,
} from "@/lib/billing/credits";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const snap = await getCreditBalance(session.supabase, session.user.id);
    return NextResponse.json({
      enabled: isCreditsEnabled(),
      balance: snap.balance,
      plan: snap.plan,
      proTier: snap.proTier,
      stripeSubscriptionStatus: snap.stripeSubscriptionStatus,
      free: {
        dailyGrant: FREE_DAILY_CREDITS,
        monthlyCap: FREE_MONTHLY_GRANT_CAP,
        monthGranted: snap.freeMonthGranted,
        lastDailyGrantDate: snap.lastDailyGrantDate,
      },
    });
  } catch (err) {
    console.error("[credits]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load credits",
        code: "CREDITS_UNAVAILABLE",
        enabled: isCreditsEnabled(),
        balance: null,
      },
      { status: 503 }
    );
  }
}
