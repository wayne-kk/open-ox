import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { listTagsForProject, setProjectTags } from "@/lib/tagManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id, { allowAdmin: true });
  if ("error" in access) return access.error;
  const tags = await listTagsForProject(access.db, id);
  return NextResponse.json(tags);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id, { allowAdmin: true });
  if ("error" in access) return access.error;

  let body: { tagIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.tagIds) || !body.tagIds.every((t) => typeof t === "string")) {
    return NextResponse.json(
      { error: "tagIds must be a string array", code: "INVALID_TAG_IDS" },
      { status: 400 }
    );
  }

  try {
    const tags = await setProjectTags(
      access.db,
      access.project.ownerUserId ?? session.user.id,
      id,
      body.tagIds
    );
    return NextResponse.json(tags);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update tags";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
