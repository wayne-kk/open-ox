import { NextRequest, NextResponse } from "next/server";
import { getProject, renameProject, deleteProject, setProjectFolder } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { getDevServerStatus, stopDevServer } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

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
  return NextResponse.json(project);
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
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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

  const serverStatus = await getDevServerStatus(db, id);
  if (serverStatus.status === "running") {
    await stopDevServer(db, id);
  }

  await deleteProject(db, id);
  deleteProjectFiles(id).catch((err) =>
    console.error("[DELETE /api/projects/:id] Storage cleanup failed:", err)
  );
  return new NextResponse(null, { status: 204 });
}
