import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import {
  BRAND_REMOVAL_PRICE_CREDITS,
  hasProjectBrandRemoval,
  purchaseProjectBrandRemoval,
} from "@/lib/branding/projectBrandEntitlement";
import { getCreditBalance } from "@/lib/billing/account";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { syncStaticSitePreview } from "@/lib/staticSitePreview";
import { trackServerAnalyticsEvent } from "@/lib/analytics/serverEvents";
import { AnalyticsEventName } from "@/lib/analytics/catalog";
import { enqueueProjectDeploy, getProjectDeployStatus } from "@/lib/vercel/deploy";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  try {
    const admin = createSupabaseServiceRoleClient();
    const [removed, credits, deployStatus] = await Promise.all([
      hasProjectBrandRemoval(admin, id),
      getCreditBalance(admin, session.user.id),
      getProjectDeployStatus(id),
    ]);
    return NextResponse.json({
      removed,
      balance: credits.balance,
      priceCredits: BRAND_REMOVAL_PRICE_CREDITS,
      hasProductionDeployment: Boolean(deployStatus.productionUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message, code: "BRANDING_STATUS_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  let body: { idempotencyKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", code: "INVALID_BODY" },
      { status: 400 },
    );
  }
  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return NextResponse.json(
      { error: "Invalid idempotency key", code: "INVALID_IDEMPOTENCY_KEY" },
      { status: 400 },
    );
  }

  const admin = createSupabaseServiceRoleClient();
  await getCreditBalance(admin, session.user.id);
  const result = await purchaseProjectBrandRemoval(admin, {
    projectId: id,
    userId: session.user.id,
    idempotencyKey,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.code === "INSUFFICIENT_CREDITS" ? 402 : 500 },
    );
  }

  const removed = await hasProjectBrandRemoval(admin, id);
  if (!removed) {
    return NextResponse.json(
      { error: "Brand removal entitlement is not active", code: "ENTITLEMENT_NOT_ACTIVE" },
      { status: 409 },
    );
  }

  if (access.project.publishPreview) {
    after(async () => {
      try {
        await syncStaticSitePreview(admin, id, { force: true });
      } catch (error) {
        console.error(
          `[branding] preview refresh failed projectId=${id}:`,
          error,
        );
      }
    });
  }

  let redeployScheduled = false;
  let redeployError: string | null = null;
  try {
    const deployStatus = await getProjectDeployStatus(id);
    if (deployStatus.productionUrl) {
      const { job } = await enqueueProjectDeploy({
        projectId: id,
        userId: session.user.id,
      });
      redeployScheduled = true;
      after(async () => {
        try {
          await job;
        } catch (error) {
          console.error(`[branding] Vercel redeploy failed projectId=${id}:`, error);
        }
      });
    }
  } catch (error) {
    redeployError = error instanceof Error ? error.message : String(error);
  }

  await trackServerAnalyticsEvent({
    userId: session.user.id,
    eventName: AnalyticsEventName.brandRemovalPurchase,
    properties: {
      project_id: id,
      charged_credits: result.charged,
      purchased: result.purchased,
    },
  });

  return NextResponse.json({
    ok: true,
    removed,
    charged: result.charged,
    balance: result.balance,
    purchased: result.purchased,
    previewRefreshScheduled: access.project.publishPreview === true,
    redeployScheduled,
    redeployError,
  });
}
