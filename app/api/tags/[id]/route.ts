import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { deleteTag, renameTag } from "@/lib/tagManager";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name : "";
    const tag = await renameTag(session.supabase, session.user.id, id, name);
    return NextResponse.json(tag);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to rename tag";
    const status = msg === "Tag not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteTag(session.supabase, session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete tag";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
