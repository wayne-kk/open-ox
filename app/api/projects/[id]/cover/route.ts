import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

const BUCKET = "project-files";

/**
 * Authenticated JPEG for project list thumbnails (Storage is private).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getProject(session.supabase, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }
  if (project.coverImageStatus !== "ready" || !project.coverImageStoragePath?.trim()) {
    return NextResponse.json({ error: "Cover not ready", code: "COVER_NOT_READY" }, { status: 404 });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured", code: "SERVICE_ROLE" }, { status: 503 });
  }

  const rel = project.coverImageStoragePath.trim().replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes(":")) {
    return NextResponse.json({ error: "Invalid cover path", code: "BAD_COVER_PATH" }, { status: 400 });
  }
  const storagePath = `${id}/${rel}`.replace(/\\/g, "/");

  const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    console.error("[GET /api/projects/:id/cover] download:", error?.message);
    return NextResponse.json({ error: "Cover file missing", code: "COVER_NOT_FOUND" }, { status: 404 });
  }

  const buf = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
