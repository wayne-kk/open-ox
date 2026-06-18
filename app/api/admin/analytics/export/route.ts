import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError } from "@/lib/admin/apiResponse";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";
import { parseAnalyticsQuery } from "@/lib/admin/analytics/queryParams";
import { fetchActivationFunnel, funnelToCsv } from "@/lib/admin/analytics/funnel";
import { fetchRetentionMatrix, retentionToCsv } from "@/lib/admin/analytics/retention";
import { fetchEngagement, engagementToCsv } from "@/lib/admin/analytics/engagement";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (type !== "funnel" && type !== "retention" && type !== "engagement") {
    return apiError("type must be funnel, retention, or engagement", 400);
  }

  const query = parseAnalyticsQuery(req);

  try {
    let csv = "";
    let filename = "";
    let metadata: Record<string, unknown> = {};

    if (type === "funnel") {
      const data = await fetchActivationFunnel(query);
      csv = funnelToCsv(data);
      filename = `activation-funnel-${data.range.from}-${data.range.to}.csv`;
      metadata = { type, range: data.range, excludeInternal: data.excludeInternal };
    } else if (type === "retention") {
      const data = await fetchRetentionMatrix(query);
      csv = retentionToCsv(data);
      filename = `retention-${data.anchor}-${data.range.from}-${data.range.to}.csv`;
      metadata = {
        type,
        anchor: data.anchor,
        range: data.range,
        excludeInternal: data.excludeInternal,
      };
    } else {
      const data = await fetchEngagement(query);
      csv = engagementToCsv(data);
      filename = `engagement-${data.range.from}-${data.range.to}.csv`;
      metadata = { type, range: data.range, excludeInternal: data.excludeInternal };
    }

    await writeAdminAuditLog({
      adminUserId: auth.user.id,
      action: "analytics_export",
      resource: type,
      metadata,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err), 500);
  }
}
