import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { loadStepModelsFromDB } from "@/lib/config/models";
import { generateVibeDirections } from "@/lib/studio/generateVibeDirections";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  let briefMarkdown = "";
  try {
    const body = (await req.json()) as { briefMarkdown?: unknown };
    if (typeof body.briefMarkdown === "string") {
      briefMarkdown = body.briefMarkdown;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  await loadStepModelsFromDB();
  const result = await generateVibeDirections(briefMarkdown);

  return NextResponse.json({
    success: true,
    data: {
      directions: result.directions,
      source: result.source,
    },
  });
}
