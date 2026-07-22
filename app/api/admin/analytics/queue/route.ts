import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { fetchCachedQueueHealth } from "@/lib/admin/analytics/cachedQueries";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const data = await fetchCachedQueueHealth();
    return apiSuccess(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(message, 500);
  }
}
