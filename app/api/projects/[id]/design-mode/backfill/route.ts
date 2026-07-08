import { NextResponse } from "next/server";

import { backfillOxAnchorsInProject } from "@/lib/studio/designMode/backfillOxAnchors";
import { isStudioDesignModeEnabled } from "@/lib/studio/designMode/featureFlag";
import { getSessionUser } from "@/lib/auth/session";
import { getProject, getSiteRoot } from "@/lib/projectManager";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  if (!isStudioDesignModeEnabled()) {
    return NextResponse.json({ error: "Design Mode is disabled", code: "DESIGN_MODE_DISABLED" }, { status: 403 });
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(session.supabase, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const projectDir = getSiteRoot(id);
  const result = await backfillOxAnchorsInProject(projectDir);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
