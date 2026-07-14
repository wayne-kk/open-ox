import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getFeishuActiveProject,
  setFeishuActiveProject,
} from "@/lib/feishu/activeProject";

export const runtime = "nodejs";

/** GET /api/feishu/active-project — current Feishu active project for the session user */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const active = await getFeishuActiveProject(session.supabase, session.user.id);
    return NextResponse.json(active);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}

/**
 * PUT /api/feishu/active-project
 * Body: { projectId: string | null }
 */
export async function PUT(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let projectId: string | null;
  try {
    const body = await req.json();
    if (body.projectId === null) {
      projectId = null;
    } else if (typeof body.projectId === "string" && body.projectId.trim()) {
      projectId = body.projectId.trim();
    } else {
      return NextResponse.json(
        { error: "projectId must be a non-empty string or null", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const result = await setFeishuActiveProject(session.supabase, session.user.id, projectId);
    if (!result.ok) {
      const status = result.code === "FORBIDDEN" ? 403 : 404;
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status }
      );
    }
    return NextResponse.json({
      projectId: result.projectId,
      projectName: result.projectName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}
