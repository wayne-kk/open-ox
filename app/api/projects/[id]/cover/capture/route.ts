import { NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { scheduleManualCaptureProjectCover } from "@/lib/projectCoverCapture";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

/**
 * POST /api/projects/[id]/cover/capture — queue a fresh desktop viewport screenshot (1480×960).
 * 202 Accepted: job started in-process (runs even when OPEN_OX_COVER_CAPTURE=0).
 * Owner-only; requires SUPABASE_SERVICE_ROLE_KEY at runtime.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { user, supabase: db } = session;
  const { id } = await params;

  const project = await getProject(db, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  if (!project.ownerUserId || project.ownerUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Cover capture unavailable (missing service role)", code: "SERVICE_ROLE" },
      { status: 503 }
    );
  }

  scheduleManualCaptureProjectCover(id);
  return NextResponse.json({ ok: true, code: "QUEUED" }, { status: 202 });
}
