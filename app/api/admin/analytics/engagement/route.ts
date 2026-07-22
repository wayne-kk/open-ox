import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { parseAnalyticsQuery } from "@/lib/admin/analytics/queryParams";
import { fetchCachedEngagement } from "@/lib/admin/analytics/cachedQueries";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const query = parseAnalyticsQuery(req);
    const data = await fetchCachedEngagement(
      query.from,
      query.to,
      query.excludeInternal,
    );
    return apiSuccess(data, { range: data.range });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
