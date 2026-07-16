import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createTag, listTags } from "@/lib/tagManager";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const tags = await listTags(session.supabase, session.user.id);
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name : "";
    const tag = await createTag(session.supabase, session.user.id, name);
    return NextResponse.json(tag);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create tag";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
