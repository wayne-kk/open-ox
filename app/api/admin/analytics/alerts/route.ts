import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { fetchCachedAdminAlerts } from "@/lib/admin/analytics/cachedQueries";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const data = await fetchCachedAdminAlerts();
    return apiSuccess(data);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
