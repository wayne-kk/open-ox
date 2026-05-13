import { NextRequest, NextResponse } from "next/server";
import { getProject, renameProject, deleteProject, setProjectFolder } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { stopDevServer } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { loadFoldedBuildStepsForRun } from "@/lib/generation/loadRunSteps";

type Params = { params: Promise<{ id: string }> };

async function enrichProjectPayloadForGenerationProgress(
  project: Awaited<ReturnType<typeof getProject>>
): Promise<Record<string, unknown>> {
  if (!project?.currentGenerationRunId || project.status !== "generating") {
    return { ...project } as Record<string, unknown>;
  }
  try {
    const admin = createSupabaseServiceRoleClient();
    const liveSteps = await loadFoldedBuildStepsForRun(admin, project.currentGenerationRunId);
    if (!liveSteps.length) {
      return { ...project } as Record<string, unknown>;
    }
    return {
      ...(project as unknown as Record<string, unknown>),
      buildSteps: liveSteps,
    };
  } catch {
    return { ...project } as Record<string, unknown>;
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getProject(session.supabase, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }
  const responsePayload = await enrichProjectPayloadForGenerationProgress(project);
  return NextResponse.json(responsePayload);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { supabase: db } = session;
  const { id } = await params;
  const project = await getProject(db, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }

  let body: { name?: string; folderId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  if (body.folderId !== undefined) {
    await setProjectFolder(db, id, body.folderId ?? null);
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid 'name' field", code: "INVALID_NAME" },
        { status: 400 }
      );
    }
    await renameProject(db, id, body.name.trim());
  }

  const updated = await getProject(db, id);
  const responsePayload = await enrichProjectPayloadForGenerationProgress(updated);
  return NextResponse.json(responsePayload);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const isAdmin = await isAdminUser({ supabase: session.supabase, userId: session.user.id });
  const db = isAdmin ? createSupabaseServiceRoleClient() : session.supabase;
  const project = await getProject(db, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Skip getDevServerStatus: on E2B it connects to the sandbox just to see if serve is up — slow and unnecessary.
  // stopDevServer only reads sandbox_id from DB and kills when present (or stops local preview).
  await stopDevServer(db, id);

  await deleteProject(db, id);
  deleteProjectFiles(id).catch((err) =>
    console.error("[DELETE /api/projects/:id] Storage cleanup failed:", err)
  );
  return new NextResponse(null, { status: 204 });
}
