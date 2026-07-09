import { NextRequest, NextResponse } from "next/server";
import { getDevServerStatus } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;
  const status = await getDevServerStatus(db, id);
  return NextResponse.json(status);
}
