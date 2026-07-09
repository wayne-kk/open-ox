import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { scheduleManualCaptureProjectCover } from "@/lib/projectCoverCapture";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

/**
 * POST /api/projects/[id]/cover/capture — queue a fresh desktop viewport screenshot (1480×960),
 * then apply cinematic polish (safe margin, vignette, subtle letterbox) before upload.
 * 202 Accepted: job started in-process (runs even when OPEN_OX_COVER_CAPTURE=0).
 * Requires authentication; requires SUPABASE_SERVICE_ROLE_KEY at runtime.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;

  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

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
