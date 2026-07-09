import { NextResponse } from "next/server";

import { backfillOxAnchorsInProject } from "@/lib/studio/designMode/backfillOxAnchors";
import { isStudioDesignModeEnabled } from "@/lib/studio/designMode/featureFlag";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { getSiteRoot } from "@/lib/projectManager";

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
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  const projectDir = getSiteRoot(id);
  const result = await backfillOxAnchorsInProject(projectDir);

  return NextResponse.json({
    success: true,
    data: result,
  });
}
