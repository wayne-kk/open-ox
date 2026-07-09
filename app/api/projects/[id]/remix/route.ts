import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";
import { remixProject } from "@/lib/remixProject";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/remix — copy a Community remixable project into the caller's Workspace.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: sourceProjectId } = await params;
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured", code: "SERVICE_ROLE" }, { status: 503 });
  }

  try {
    const { project, filesCopied } = await remixProject({
      adminDb: admin,
      remixerDb: session.supabase,
      sourceProjectId,
      remixerUserId: session.user.id,
      remixerUsername: getUserDisplayName(session.user),
    });
    return NextResponse.json({
      projectId: project.id,
      name: project.name,
      filesCopied,
      remixedFromProjectId: project.remixedFromProjectId,
      remixedFromTitle: project.remixedFromTitle,
      remixedFromOwnerUsername: project.remixedFromOwnerUsername,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    if (message === "REMIX_NOT_ALLOWED") {
      return NextResponse.json(
        { error: "该项目未开放 Remix", code: "REMIX_NOT_ALLOWED" },
        { status: 403 }
      );
    }
    if (message === "SOURCE_FILES_MISSING") {
      return NextResponse.json(
        { error: "源项目文件不可用", code: "SOURCE_FILES_MISSING" },
        { status: 409 }
      );
    }
    console.error("[POST /api/projects/:id/remix]", err);
    return NextResponse.json(
      { error: "Remix failed", code: "REMIX_ERROR" },
      { status: 500 }
    );
  }
}
