import { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { getProject, setProjectPublishSettings } from "@/lib/projectManager";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/projects/[id]/unlist — force Publish Preview off (clears Allow Remix).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return apiError("Server misconfigured", 503, "SERVICE_ROLE");
  }

  try {
    const current = await getProject(admin, id);
    if (!current) {
      return apiError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    const updated = await setProjectPublishSettings(
      admin,
      id,
      { publishPreview: false },
      current
    );

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      publishPreview: updated.publishPreview === true,
      allowRemix: updated.allowRemix === true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(message, 500, "ADMIN_UNLIST_ERROR");
  }
}
