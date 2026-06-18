import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { fetchUserAnalytics } from "@/lib/admin/analytics/userAnalytics";

export async function GET(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { userId } = await context.params;
  if (!userId) return apiError("userId required", 400);

  const days = Number.parseInt(new URL(req.url).searchParams.get("days") ?? "90", 10) || 90;

  try {
    const data = await fetchUserAnalytics({
      userId,
      adminUserId: auth.user.id,
      days,
    });
    if (!data) return apiError("User not found", 404);
    return apiSuccess(data);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
