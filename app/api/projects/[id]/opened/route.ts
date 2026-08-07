import { NextResponse } from "next/server";

import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { getSessionUser } from "@/lib/auth/session";
import { touchProjectOpened } from "@/lib/projectManager";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/opened — record that the owner opened Studio for this project.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id, { allowAdmin: true });
  if ("error" in access) return access.error;

  try {
    const lastOpenedAt = await touchProjectOpened(access.db, id);
    return NextResponse.json({ ok: true, lastOpenedAt });
  } catch (err) {
    console.error("[POST /api/projects/:id/opened]", err);
    return NextResponse.json(
      { error: "Failed to record project open", code: "OPENED_ERROR" },
      { status: 500 }
    );
  }
}
