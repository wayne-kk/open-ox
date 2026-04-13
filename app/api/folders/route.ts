import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createFolder, listFolders } from "@/lib/folderManager";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const folders = await listFolders(session.supabase, session.user.id);
  return NextResponse.json(folders);
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name : "";
    const folder = await createFolder(session.supabase, session.user.id, name);
    return NextResponse.json(folder);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create folder";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
