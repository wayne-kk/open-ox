import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectStatus } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import {
  recoverableGenerationErrorMessage,
} from "@/lib/generationRecovery";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/recovery
 * Body: { action: "unlock_stuck" } — move stuck `generating` → `failed` with recoverable error; keeps build_steps / blueprint.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  if (body.action !== "unlock_stuck") {
    return NextResponse.json(
      { error: "Unsupported action", code: "UNSUPPORTED_ACTION" },
      { status: 400 }
    );
  }

  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { project, db } = access;

  if (project.status !== "generating") {
    return NextResponse.json(
      { error: "Project is not in generating state", code: "INVALID_STATUS" },
      { status: 409 }
    );
  }

  await db
    .from("generation_runs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      lease_owner: null,
      lease_until: null,
    })
    .eq("project_id", id)
    .eq("status", "queued");

  await updateProjectStatus(db, id, "failed", {
    error: recoverableGenerationErrorMessage(),
    currentGenerationRunId: null,
  });

  const updated = await getProject(db, id);
  return NextResponse.json(updated);
}
