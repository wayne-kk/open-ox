import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { evaluateAdminAlerts } from "@/lib/admin/analytics/alerts";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const data = await evaluateAdminAlerts();
    return apiSuccess(data);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
