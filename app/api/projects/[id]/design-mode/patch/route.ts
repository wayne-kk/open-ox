import { NextRequest, NextResponse } from "next/server";

import { runWithSiteRoot } from "@/ai/tools/system/common";
import { applyDirectVisualEdits } from "@/lib/studio/designMode/directPatch/applyDirectPatch";
import { isDesignModeDirectEditCapable } from "@/lib/studio/designMode/featureFlag";
import type { VisualEdit } from "@/lib/studio/designMode/protocol";
import { getPreviewBackend } from "@/lib/previewMode";
import { classifyModificationScope } from "@/lib/previewShared";
import { hotRefreshDevServer } from "@/lib/devServerManager";
import { syncLocalProjectFingerprint } from "@/lib/previewFingerprintDb";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { getSiteRoot } from "@/lib/projectManager";
import { ensureProjectSourcesOnDisk } from "@/lib/storage";
import { getBoardRunStore } from "@/lib/modify/boardRun/fileBoardRunStore";
import { isBoardRunBlocking } from "@/lib/modify/boardRun/isBoardRunBlocking";

type Params = { params: Promise<{ id: string }> };

function parseEdits(body: unknown): VisualEdit[] | null {
  if (!body || typeof body !== "object") return null;
  const edits = (body as { edits?: unknown }).edits;
  if (!Array.isArray(edits) || edits.length === 0) return null;
  return edits as VisualEdit[];
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!isDesignModeDirectEditCapable()) {
    return NextResponse.json(
      {
        error:
          getPreviewBackend() !== "local"
            ? "Direct Apply is only available on local next-dev preview. Use Modify with the selection."
            : "Direct Apply is disabled (set NEXT_PUBLIC_STUDIO_DESIGN_MODE=1 with OPEN_OX_PREVIEW_BACKEND=local).",
        code: "DIRECT_EDIT_DISABLED",
        previewBackend: getPreviewBackend(),
        directEditCapable: false,
      },
      { status: 403 }
    );
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;

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

  const activeBoard = await getBoardRunStore().loadActive(id);
  if (isBoardRunBlocking(activeBoard)) {
    return NextResponse.json(
      {
        error:
          "A task board is active. Finish or cancel the board before Direct Apply.",
        code: "BOARD_RUN_ACTIVE",
      },
      { status: 409 }
    );
  }

  await ensureProjectSourcesOnDisk(id, { db });

  const projectDir = getSiteRoot(id);
  // verifyWrittenSourceFile / tsxDiagnostics require ALS site-root scope.
  const result = await runWithSiteRoot(projectDir, () =>
    applyDirectVisualEdits(projectDir, edits, { classNameHint })
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code ?? "PATCH_FAILED" }, { status: 422 });
  }

  try {
    await syncLocalProjectFingerprint(db, id);
  } catch {
    /* non-fatal */
  }

  const refreshMode = classifyModificationScope(result.diffs);
  let preview: { url?: string; refreshMode: string } = { refreshMode };
  try {
    const refreshed = await hotRefreshDevServer(db, id, result.changedFiles);
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
