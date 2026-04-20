import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listProjectOwnerOptions } from "@/lib/projectManager";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const owners = await listProjectOwnerOptions(session.supabase);
    return NextResponse.json(owners);
  } catch (err) {
    console.error("[GET /api/projects/owners]", err);
    return NextResponse.json(
      { error: "Failed to list project owners", code: "LIST_PROJECT_OWNERS_ERROR" },
      { status: 500 }
    );
  }
}
