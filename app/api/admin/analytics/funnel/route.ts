import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { parseAnalyticsQuery } from "@/lib/admin/analytics/queryParams";
import { fetchCachedActivationFunnel } from "@/lib/admin/analytics/cachedQueries";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const query = parseAnalyticsQuery(req);
  try {
    const data = await fetchCachedActivationFunnel(
      query.from,
      query.to,
      query.excludeInternal,
    );
    return apiSuccess(data, {
      range: data.range,
      excludeInternal: data.excludeInternal,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
