import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

const BUCKET = "project-files";

const SIGNED_URL_TTL_SEC = 3600;

function coverProxyBytesFlag(): boolean {
  return process.env.OPEN_OX_COVER_PROXY_BYTES?.trim() === "1";
}

/**
 * Project list cover JPEG (Storage `project-files` bucket).
 *
 * - **Logged in**: `getProject` via session client (RLS).
 * - **Guest**: `getProject` via service role only after caller has no session — same data as public gallery; only served when `coverImageStatus === "ready"`.
 *
 * Default: **302** to short-lived signed URL. `OPEN_OX_COVER_PROXY_BYTES=1` proxies bytes through this route.
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

  const project = session
    ? await getProject(session.supabase, id)
    : await getProject(admin, id);

  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }
  if (project.coverImageStatus !== "ready" || !project.coverImageStoragePath?.trim()) {
    return NextResponse.json({ error: "Cover not ready", code: "COVER_NOT_READY" }, { status: 404 });
  }

  const rel = project.coverImageStoragePath.trim().replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes(":")) {
    return NextResponse.json({ error: "Invalid cover path", code: "BAD_COVER_PATH" }, { status: 400 });
  }
  const storagePath = `${id}/${rel}`.replace(/\\/g, "/");

  if (!coverProxyBytesFlag()) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
    if (!signErr && signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, {
        status: 302,
        // Do not cache the redirect: the Location URL embeds a time-limited token.
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    console.warn("[GET /api/projects/:id/cover] createSignedUrl fallback to proxy:", signErr?.message);
  }

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
