import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { fetchAdminOverview } from "@/lib/admin/analytics/queries";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const excludeInternal = searchParams.get("excludeInternal") !== "false";

  try {
    const data = await fetchAdminOverview({ from, to, excludeInternal });
    return apiSuccess(data, { range: data.range, excludeInternal: data.excludeInternal });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(message, 500);
  }
}
