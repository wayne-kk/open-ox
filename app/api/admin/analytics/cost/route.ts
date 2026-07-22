import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { parseDateRange } from "@/lib/admin/analytics/dateRange";
import { fetchCachedCostAnalytics } from "@/lib/admin/analytics/cachedQueries";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const range = parseDateRange({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });

  try {
    const data = await fetchCachedCostAnalytics(
      range.from.toISOString().slice(0, 10),
      range.to.toISOString().slice(0, 10),
    );
    return apiSuccess(data, { range: data.range });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
