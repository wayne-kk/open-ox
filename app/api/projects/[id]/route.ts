import { NextRequest, NextResponse } from "next/server";
import { getProject, renameProject, deleteProject } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { getDevServerStatus, stopDevServer } from "@/lib/devServerManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'name' field", code: "INVALID_NAME" },
      { status: 400 }
    );
  }

  await renameProject(id, body.name);
  const updated = await getProject(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 }
    );
  }

  const serverStatus = await getDevServerStatus(id);
  if (serverStatus.status === "running") {
    await stopDevServer(id);
  }

  await deleteProject(id);
  // Clean up Storage files (non-blocking)
  deleteProjectFiles(id).catch((err) =>
    console.error("[DELETE /api/projects/:id] Storage cleanup failed:", err)
  );
  return new NextResponse(null, { status: 204 });
}
