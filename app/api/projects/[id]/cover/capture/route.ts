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
 * 202 Accepted: job queued (runs even when OPEN_OX_COVER_CAPTURE=0).
 * 409 Conflict: capture already in flight — client should poll with baselineUpdatedAt.
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

  try {
    const result = await scheduleManualCaptureProjectCover(id);
    if (result.status === "in_flight") {
      return NextResponse.json(
        {
          ok: false,
          code: "COVER_CAPTURE_IN_FLIGHT",
          baselineUpdatedAt: result.baselineUpdatedAt,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        code: "QUEUED",
        baselineUpdatedAt: result.baselineUpdatedAt,
      },
      { status: 202 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "SERVICE_ROLE") {
      return NextResponse.json(
        { error: "Cover capture unavailable (missing service role)", code: "SERVICE_ROLE" },
        { status: 503 }
      );
    }
    console.error("[POST /api/projects/:id/cover/capture]", e);
    return NextResponse.json(
      { error: "Cover capture failed to start", code: "COVER_CAPTURE_ERROR" },
      { status: 500 }
    );
  }
}
