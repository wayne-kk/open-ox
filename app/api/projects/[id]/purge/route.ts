import { NextResponse } from "next/server";
import { deleteProject } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { stopDevServer } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/projects/:id/purge — permanently delete a trashed project.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id, {
    allowAdmin: true,
    allowTrashed: true,
  });
  if ("error" in access) return access.error;

  if (!access.project.deletedAt) {
    return NextResponse.json(
      { error: "Move to Recycle Bin before permanent delete", code: "PROJECT_NOT_TRASHED" },
      { status: 409 }
    );
  }

  await stopDevServer(access.db, id);
  await deleteProject(access.db, id);
  deleteProjectFiles(id).catch((err) =>
    console.error("[DELETE /api/projects/:id/purge] Storage cleanup failed:", err)
  );
  return new NextResponse(null, { status: 204 });
}
