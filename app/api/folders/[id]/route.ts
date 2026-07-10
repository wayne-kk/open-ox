import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  countProjectsInFolder,
  dissolveFolder,
  getFolder,
  renameFolder,
} from "@/lib/folderManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const folder = await getFolder(session.supabase, session.user.id, id);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    const projectCount = await countProjectsInFolder(session.supabase, session.user.id, id);
    return NextResponse.json({ ...folder, projectCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load folder";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = (await req.json()) as { name?: string };
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const folder = await renameFolder(session.supabase, session.user.id, id, body.name);
    return NextResponse.json(folder);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to rename folder";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const result = await dissolveFolder(session.supabase, session.user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to dissolve folder";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
