import { NextRequest, NextResponse } from "next/server";

import { applyDirectVisualEdits } from "@/lib/studio/designMode/directPatch/applyDirectPatch";
import { isStudioDesignModeEnabled } from "@/lib/studio/designMode/featureFlag";
import type { VisualEdit } from "@/lib/studio/designMode/protocol";
import { classifyModificationScope } from "@/lib/previewShared";
import { hotRefreshDevServer } from "@/lib/devServerManager";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import { getSessionUser } from "@/lib/auth/session";
import { getProject, getSiteRoot } from "@/lib/projectManager";

type Params = { params: Promise<{ id: string }> };

function parseEdits(body: unknown): VisualEdit[] | null {
  if (!body || typeof body !== "object") return null;
  const edits = (body as { edits?: unknown }).edits;
  if (!Array.isArray(edits) || edits.length === 0) return null;
  return edits as VisualEdit[];
}

export async function POST(req: NextRequest, { params }: Params) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const edits = parseEdits(body);
  if (!edits) {
    return NextResponse.json({ error: "Missing edits[]", code: "INVALID_EDITS" }, { status: 400 });
  }

  const classNameHint =
    typeof (body as { classNameHint?: unknown }).classNameHint === "string"
      ? (body as { classNameHint: string }).classNameHint
      : undefined;

  const projectDir = getSiteRoot(id);
  const result = await applyDirectVisualEdits(projectDir, edits, { classNameHint });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: "PATCH_FAILED" }, { status: 422 });
  }

  try {
    await syncLocalProjectFingerprint(session.supabase, id);
  } catch {
    /* non-fatal */
  }

  const refreshMode = classifyModificationScope(result.diffs);
  let preview: { url?: string; refreshMode: string } = { refreshMode };
  try {
    const refreshed = await hotRefreshDevServer(session.supabase, id, result.changedFiles);
    preview = { url: refreshed.url, refreshMode: refreshed.mode ?? refreshMode };
  } catch (err) {
    console.error("[POST design-mode/patch] preview refresh failed:", err);
  }

  return NextResponse.json({
    success: true,
    data: {
      diffs: result.diffs,
      changedFiles: result.changedFiles,
      refreshMode,
      previewUrl: preview.url ?? null,
    },
  });
}
