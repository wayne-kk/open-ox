import { NextRequest, NextResponse } from "next/server";
import {
  startDevServer,
  stopDevServer,
  rebuildDevServer,
  hotRefreshDevServer,
  classifyModificationScope,
  ensureDevServerAlive,
} from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import {
  canAccessStaticPreview,
  forbiddenProjectResponse,
  projectNotFoundResponse,
  requireOwnedProject,
} from "@/lib/auth/projectAccess";
import { isAdminUser } from "@/lib/auth/roles";
import { getProject } from "@/lib/projectManager";
import { attachPreviewAccessGrantIfNeeded } from "@/lib/previewAccessGrantAttach";
import { getPreviewBackend, isPreviewStorage } from "@/lib/previewMode";
import { getStaticPreviewUrl } from "@/lib/staticSitePreview";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { isDesignModeDirectEditCapable } from "@/lib/studio/designMode/featureFlag";

type Params = { params: Promise<{ id: string }> };

function withPreviewMeta<T extends Record<string, unknown>>(payload: T) {
  const previewBackend = getPreviewBackend();
  return {
    ...payload,
    previewBackend,
    directEditCapable: isDesignModeDirectEditCapable(),
  };
}

/**
 * GET /api/projects/[id]/preview — health check + auto-recover
 *
 * Returns { status: "ok", url } if the sandbox serve is alive.
 * If the sandbox is running but serve crashed, restarts serve and returns ok.
 * Returns { status: "down" } if the sandbox is gone entirely.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;
  try {
    const result = await ensureDevServerAlive(db, id);
    const payload =
      result.status === "ok" && typeof result.url === "string"
        ? attachPreviewAccessGrantIfNeeded(id, { ...result, url: result.url })
        : result;
    return NextResponse.json(withPreviewMeta(payload as Record<string, unknown>));
  } catch (err) {
    console.error("[GET /api/projects/[id]/preview]", err);
    return NextResponse.json({ status: "down" });
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionUser();

  if (!session) {
    if (!isPreviewStorage()) {
      return NextResponse.json(
        {
          error:
            "访客仅支持静态站点预览（需 OPEN_OX_PREVIEW_BACKEND=storage）。请登录后使用完整预览与编辑。",
          code: "PREVIEW_LOGIN_REQUIRED",
        },
        { status: 401 }
      );
    }
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch {
      return NextResponse.json({ error: "Server misconfigured", code: "SERVICE_ROLE" }, { status: 503 });
    }
    const project = await getProject(admin, id);
    if (!project) return projectNotFoundResponse();
    if (!canAccessStaticPreview(project, { userId: null, isAdmin: false })) {
      return forbiddenProjectResponse();
    }
    if (project.status !== "ready") {
      return NextResponse.json(
        { error: "项目尚未就绪，无法预览", code: "PROJECT_NOT_READY" },
        { status: 403 }
      );
    }
    try {
      const url = getStaticPreviewUrl(id);
      return NextResponse.json(withPreviewMeta({ url, mode: "storage-public" as const }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[POST /api/projects/[id]/preview] guest static url:", msg);
      return NextResponse.json(
        { error: "预览地址不可用（检查 NEXT_PUBLIC_SITE_URL）", code: "PREVIEW_URL_ERROR" },
        { status: 503 }
      );
    }
  }

  const access = await requireOwnedProject(session, id, { allowAdmin: true });
  if ("error" in access) {
    // Non-owner may open Community static preview when Publish Preview is on.
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch {
      return access.error;
    }
    const project = await getProject(admin, id);
    if (!project) return projectNotFoundResponse();
    const isAdmin = await isAdminUser({
      supabase: session.supabase,
      userId: session.user.id,
    });
    if (!canAccessStaticPreview(project, { userId: session.user.id, isAdmin })) {
      return forbiddenProjectResponse();
    }
    if (!isPreviewStorage()) {
      return NextResponse.json(
        {
          error: "仅支持静态站点预览（需 OPEN_OX_PREVIEW_BACKEND=storage）",
          code: "PREVIEW_STORAGE_REQUIRED",
        },
        { status: 403 }
      );
    }
    try {
      const url = getStaticPreviewUrl(id);
      return NextResponse.json(withPreviewMeta({ url, mode: "storage-public" as const }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg, code: "PREVIEW_URL_ERROR" }, { status: 503 });
    }
  }

  const { db } = access;
  try {
    const result = await startDevServer(db, id);
    return NextResponse.json(
      withPreviewMeta(attachPreviewAccessGrantIfNeeded(id, result) as Record<string, unknown>)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Project directory not found")) {
      return NextResponse.json(
        { error: "Project directory not found", code: "PROJECT_DIR_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[POST /api/projects/[id]/preview]", err);
    return NextResponse.json(
      { error: "Failed to start dev server", code: "DEV_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/** PUT /api/projects/[id]/preview — resync files + rebuild + restart
 *
 * Accepts optional body:
 *   { diffs?: Array<{ file, patch, stats }>, changedFiles?: string[] }
 *
 * If diffs are provided, classifies the modification scope:
 *   - "hot": only upload changed files + rebuild (skip dep install)
 *   - "rebuild": full resync + dep install + rebuild
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;
  try {
    let body: {
      diffs?: Array<{ file: string; patch: string; stats: { additions: number; deletions: number } }>;
      changedFiles?: string[];
    } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — fall back to full rebuild
    }

    // If diffs are provided, try hot refresh for cosmetic changes
    if (body.diffs && body.diffs.length > 0) {
      const mode = classifyModificationScope(body.diffs);
      if (mode === "hot" && body.changedFiles && body.changedFiles.length > 0) {
        console.log(`[PUT /preview] Hot refresh for ${body.changedFiles.length} file(s)`);
        const result = attachPreviewAccessGrantIfNeeded(
          id,
          await hotRefreshDevServer(db, id, body.changedFiles)
        );
        return NextResponse.json(withPreviewMeta({ ...result, refreshMode: "hot" }));
      }
    }

    // Full rebuild
    console.log(`[PUT /preview] Full rebuild for project ${id}`);
    const result = attachPreviewAccessGrantIfNeeded(id, await rebuildDevServer(db, id));
    console.log(`[PUT /preview] Rebuild complete: ${result.url}`);
    return NextResponse.json(withPreviewMeta({ ...result, refreshMode: "rebuild" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PUT /api/projects/[id]/preview] Error:", message);
    return NextResponse.json(
      { error: message, code: "REBUILD_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;
  await stopDevServer(db, id);
  return new NextResponse(null, { status: 204 });
}
