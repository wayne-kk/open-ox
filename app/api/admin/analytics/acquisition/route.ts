import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { fetchAcquisition } from "@/lib/admin/analytics/acquisition";
import { parseAnalyticsQuery } from "@/lib/admin/analytics/queryParams";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const data = await fetchAcquisition(parseAnalyticsQuery(req));
    return apiSuccess(data, { range: data.range });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
