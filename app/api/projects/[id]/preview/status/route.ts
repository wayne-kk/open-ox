import { NextRequest, NextResponse } from "next/server";
import { getDevServerStatus } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import { getProject } from "@/lib/projectManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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
  const status = await getDevServerStatus(db, id);
  return NextResponse.json(status);
}
