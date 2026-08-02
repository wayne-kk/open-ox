import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { listProjectSitemapShards } from "@/lib/seo/projectSearchRepository";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const STATUSES = ["pending", "processing", "completed", "dead"] as const;

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const db = createSupabaseServiceRoleClient();
  try {
    const [shards, projectCountResult, counts, recent] = await Promise.all([
      listProjectSitemapShards(),
      db.from("search_indexable_projects").select("id", { count: "exact", head: true }),
      Promise.all(STATUSES.map(async (status) => {
        const { count, error } = await db
          .from("search_discovery_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        if (error) throw error;
        return [status, count ?? 0] as const;
      })),
      db
        .from("search_discovery_jobs")
        .select("id,project_id,action,status,attempts,pending_engines,engine_results,last_error,created_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (projectCountResult.error) throw projectCountResult.error;
    const projectCount = projectCountResult.count ?? 0;
    if (recent.error) throw recent.error;
    return apiSuccess({
      sitemap: {
        projectCount,
        projectShards: shards.length,
      },
      counts: Object.fromEntries(counts),
      jobs: recent.data ?? [],
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : String(error), 500, "SEARCH_DISCOVERY_STATUS_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null) as { jobId?: string } | null;
  if (!body?.jobId) return apiError("jobId is required", 400, "INVALID_BODY");
  const db = createSupabaseServiceRoleClient();
  const current = await db
    .from("search_discovery_jobs")
    .select("id,action")
    .eq("id", body.jobId)
    .eq("status", "dead")
    .maybeSingle();
  if (current.error) return apiError(current.error.message, 500, "SEARCH_DISCOVERY_RETRY_ERROR");
  if (!current.data) return apiError("Dead-letter job not found", 404, "JOB_NOT_FOUND");
  const { data, error } = await db
    .from("search_discovery_jobs")
    .update({
      status: "pending",
      attempts: 0,
      pending_engines: ["indexnow", "baidu"],
      next_attempt_at: new Date().toISOString(),
    })
    .eq("id", body.jobId)
    .select("id")
    .maybeSingle();
  if (error) return apiError(error.message, 500, "SEARCH_DISCOVERY_RETRY_ERROR");
  if (!data) return apiError("Job not found", 404, "JOB_NOT_FOUND");
  return apiSuccess({ retried: data.id });
}
