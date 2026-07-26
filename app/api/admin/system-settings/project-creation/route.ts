import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";
import {
  isProjectCreationMaintenance,
  setProjectCreationMaintenance,
} from "@/lib/projectCreationMaintenance.server";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  return apiSuccess({ maintenance: await isProjectCreationMaintenance() });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { maintenance?: unknown };
  try {
    body = (await req.json()) as { maintenance?: unknown };
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  if (typeof body.maintenance !== "boolean") {
    return apiError("maintenance must be a boolean", 400);
  }

  try {
    await setProjectCreationMaintenance({
      enabled: body.maintenance,
      adminUserId: auth.user.id,
    });
    await writeAdminAuditLog({
      adminUserId: auth.user.id,
      action: "project_creation_maintenance_updated",
      resource: "system:project_creation",
      metadata: { maintenance: body.maintenance },
    });
    return apiSuccess({ maintenance: body.maintenance });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Failed to update system setting",
      500,
      "SYSTEM_SETTING_UPDATE_ERROR"
    );
  }
}
