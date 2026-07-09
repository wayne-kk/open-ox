import { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { listProjectsSummary } from "@/lib/projectManager";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const ADMIN_LIST_MAX = 100;

/**
 * GET /api/admin/projects — all projects (service role), for moderation.
 * Query: offset, limit (capped).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return apiError("Server misconfigured", 503, "SERVICE_ROLE");
  }

  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const rawLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 50;
    const limit = Math.min(rawLimit, ADMIN_LIST_MAX);

    const projectsRaw = await listProjectsSummary(admin, { limit, offset });

    const projects = projectsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      ownerUsername: p.ownerUsername ?? null,
      publishPreview: p.publishPreview === true,
      allowRemix: p.allowRemix === true,
      staticPreviewSyncedAt: p.staticPreviewSyncedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return apiSuccess({ projects }, { limit, offset });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(message, 500, "ADMIN_PROJECTS_LIST_ERROR");
  }
}
