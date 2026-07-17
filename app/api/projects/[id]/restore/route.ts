import { NextResponse } from "next/server";
import { getProject, restoreProject } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/restore — move project out of Recycle Bin.
 * Does not re-enable Publish Preview / Allow Remix.
 */
export async function POST(_req: Request, { params }: Params) {
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

  const project = access.project;
  if (!project.deletedAt) {
    return NextResponse.json(
      { error: "Project is not in Recycle Bin", code: "PROJECT_NOT_TRASHED" },
      { status: 409 }
    );
  }

  await restoreProject(access.db, id);
  const updated = await getProject(access.db, id);
  return NextResponse.json(updated ?? { id, restored: true });
}
