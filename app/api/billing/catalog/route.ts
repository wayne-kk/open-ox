/**
 * GET /api/billing/catalog — public plan / top-up list for pricing UI
 */
import { NextResponse } from "next/server";
import { catalogForClient } from "@/lib/billing/catalog";
import { isCreditsEnabled } from "@/lib/billing/credits";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    creditsEnabled: isCreditsEnabled(),
    ...catalogForClient(),
  });
}
