import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import type { ProjectFolderFilter } from "@/lib/projectManager";
import { listProjectsSummary } from "@/lib/projectManager";
import { attachCoverSignedUrls, stripCoverStoragePaths } from "@/lib/projectCoverUrls";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET /api/projects/gallery — current user's Workspace projects (+ cover signed URLs).
 * Query: offset, limit, folder (`all` | `uncategorized` | folder uuid).
 * Response: { projects }
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const folderParam = (searchParams.get("folder") || "all").trim() || "all";
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

    let folder: ProjectFolderFilter = "all";
    if (folderParam === "uncategorized") folder = "uncategorized";
    else if (folderParam !== "all") folder = folderParam;

    const { supabase: db } = session;
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch {
      admin = null;
    }

    const projectsRaw = await listProjectsSummary(db, {
      userId: session.user.id,
      folder,
      limit,
      offset,
    });

    const projects =
      admin != null
        ? stripCoverStoragePaths(await attachCoverSignedUrls(admin, projectsRaw))
        : projectsRaw;

    return NextResponse.json(
      { projects },
      { headers: { "Cache-Control": "private, max-age=15" } }
    );
  } catch (err) {
    console.error("[GET /api/projects/gallery]", err);
    return NextResponse.json(
      { error: "Failed to load project gallery", code: "GALLERY_ERROR" },
      { status: 500 }
    );
  }
}
