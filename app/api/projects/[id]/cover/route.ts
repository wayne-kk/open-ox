import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import {
  canAccessStaticPreview,
  forbiddenProjectResponse,
  projectNotFoundResponse,
} from "@/lib/auth/projectAccess";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

const BUCKET = "project-files";

/**
 * Project list cover JPEG (Storage `project-files` bucket).
 * Owner / admin always; non-owners only when Publish Preview is on (slice 02).
 * Always proxies bytes (no signed-URL redirect) so `?v=` cache-busts the image the browser paints.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionUser();

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured", code: "SERVICE_ROLE" }, { status: 503 });
  }

  const project = await getProject(admin, id);
  if (!project) {
    return projectNotFoundResponse();
  }

  const isAdmin = session
    ? await isAdminUser({ supabase: session.supabase, userId: session.user.id })
    : false;

  if (
    !canAccessStaticPreview(project, {
      userId: session?.user.id ?? null,
      isAdmin,
    })
  ) {
    return forbiddenProjectResponse();
  }

  if (project.coverImageStatus !== "ready" || !project.coverImageStoragePath?.trim()) {
    return NextResponse.json({ error: "Cover not ready", code: "COVER_NOT_READY" }, { status: 404 });
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
