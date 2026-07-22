import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { parseAnalyticsQuery } from "@/lib/admin/analytics/queryParams";
import { fetchCachedRetention } from "@/lib/admin/analytics/cachedQueries";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const query = parseAnalyticsQuery(req);
  try {
    const data = await fetchCachedRetention(
      query.from,
      query.to,
      query.excludeInternal,
      query.anchor,
    );
    return apiSuccess(data, {
      range: data.range,
      excludeInternal: data.excludeInternal,
      anchor: data.anchor,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
