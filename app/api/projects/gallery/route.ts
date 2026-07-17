import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import type { ProjectFolderFilter } from "@/lib/projectManager";
import { listProjectsSummary } from "@/lib/projectManager";
import { stripCoverStoragePaths } from "@/lib/projectCoverUrls";
import {
  listTagsByProjectIds,
  normalizeGallerySearchQuery,
} from "@/lib/tagManager";

/**
 * GET /api/projects/gallery — current user's Workspace projects.
 * Covers are loaded via `/api/projects/:id/cover?v=` on the client.
 * Query: offset, limit, folder (`all` | `uncategorized` | folder uuid),
 * published (`1` = only publish_preview, any folder; ignores folder),
 * trashed (`1` = Recycle Bin only; ignores folder / published),
 * q (name / prompt search), tag (tag uuid filter).
 * `all` / `uncategorized` = root only (`folder_id` null), unless `q` is set
 * (then search spans every owned project).
 * Response: { projects } (each project includes `tags`)
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
    const publishedOnly =
      searchParams.get("published") === "1" || searchParams.get("published") === "true";
    const trashedOnly =
      searchParams.get("trashed") === "1" || searchParams.get("trashed") === "true";
    const searchQuery = normalizeGallerySearchQuery(searchParams.get("q"));
    const tagIdRaw = (searchParams.get("tag") || "").trim();
    const tagId = tagIdRaw || null;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

    let folder: ProjectFolderFilter = "all";
    if (folderParam === "uncategorized") folder = "uncategorized";
    else if (folderParam !== "all") folder = folderParam;

    const { supabase: db } = session;

    const projectsRaw = await listProjectsSummary(db, {
      userId: session.user.id,
      ...(trashedOnly
        ? { trashedOnly: true }
        : publishedOnly
          ? { publishedOnly: true }
          : { folder }),
      ...(searchQuery ? { searchQuery } : {}),
      ...(tagId && !trashedOnly ? { tagId } : {}),
      limit,
      offset,
    });

    const tagsByProject = await listTagsByProjectIds(
      db,
      projectsRaw.map((p) => p.id)
    );
    const withTags = projectsRaw.map((p) => ({
      ...p,
      tags: tagsByProject.get(p.id) ?? [],
    }));

    const projects = stripCoverStoragePaths(withTags);

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
