import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";
import { grantCredits } from "@/lib/billing/grants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ userId: string }> };

const MAX_GRANT = 10_000;

/**
 * POST /api/admin/users/[userId]/credits — manually grant credits to a user.
 * Body: { amount: number, reason?: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { userId } = await params;
  if (!userId) return apiError("userId required", 400);

  let body: { amount?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as { amount?: unknown; reason?: unknown };
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const amountRaw = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    return apiError("amount must be a positive number", 400);
  }
  const amount = Math.round(amountRaw * 10) / 10;
  if (amount > MAX_GRANT) {
    return apiError(`amount cannot exceed ${MAX_GRANT}`, 400);
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 240)
      : "Admin manual grant";

  try {
    createSupabaseServiceRoleClient();
  } catch {
    return apiError("Server misconfigured", 503, "SERVICE_ROLE");
  }

  const result = await grantCredits(undefined, {
    userId,
    amount,
    kind: "grant_adjust",
    reason,
    metadata: {
      source: "admin_manual",
      adminUserId: auth.user.id,
    },
  });

  if (!result.ok) {
    return apiError(result.message, 400);
  }

  await writeAdminAuditLog({
    adminUserId: auth.user.id,
    action: "credits_manual_grant",
    resource: `user:${userId}`,
    metadata: {
      amount: result.granted,
      balanceAfter: result.balance,
      reason,
    },
  });

  return apiSuccess({
    granted: result.granted,
    balance: result.balance,
    reason,
  });
}
