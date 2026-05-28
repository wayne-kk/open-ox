import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { listProjectOwnerOptions } from "@/lib/projectOwnerOptions";
import type { ProjectFolderFilter } from "@/lib/projectManager";
import { listProjectsSummary } from "@/lib/projectManager";
import { attachCoverSignedUrls, stripCoverStoragePaths } from "@/lib/projectCoverUrls";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const ANON_LIST_MAX = 50;

/**
 * GET /api/projects/gallery — projects list + optional owner filter options in one auth round trip.
 * Query: same as GET /api/projects (offset, limit, mine, folder, owner).
 * Response: { projects, owners? }
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const folderParam = (searchParams.get("folder") || "all").trim() || "all";
    const mine = searchParams.get("mine") === "1";
    const ownerFilter = searchParams.get("owner");
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;

    let folder: ProjectFolderFilter = "all";
    if (folderParam === "uncategorized") folder = "uncategorized";
    else if (folderParam !== "all") folder = folderParam;

    const listMine =
      mine ||
      folderParam === "uncategorized" ||
      (folderParam !== "all" && folderParam.length > 0);

    const session = await getSessionUser();
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch {
      admin = null;
    }

    if (!session) {
      if (listMine) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }
      if (!admin) {
        return NextResponse.json(
          { error: "Public project list is not configured", code: "SERVICE_ROLE" },
          { status: 503 }
        );
      }
      const rawLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;
      const limit =
        rawLimit !== undefined ? Math.min(rawLimit, ANON_LIST_MAX) : undefined;

      const [projectsRaw, owners] = await Promise.all([
        listProjectsSummary(admin, {
          filterOwnerUserId:
            ownerFilter && /^[0-9a-f-]{36}$/i.test(ownerFilter) ? ownerFilter : null,
          limit,
          offset,
        }),
        listProjectOwnerOptions(admin),
      ]);

      const projects = admin
        ? stripCoverStoragePaths(await attachCoverSignedUrls(admin, projectsRaw))
        : projectsRaw;

      return NextResponse.json(
        { projects, owners },
        { headers: { "Cache-Control": "private, max-age=15" } }
      );
    }

    const { supabase: db } = session;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

    const listOptions = listMine
      ? { userId: session.user.id, folder, limit, offset }
      : {
          filterOwnerUserId:
            ownerFilter && /^[0-9a-f-]{36}$/i.test(ownerFilter) ? ownerFilter : null,
          limit,
          offset,
        };

    const [projectsRaw, owners] = await Promise.all([
      listProjectsSummary(db, listOptions),
      listMine ? Promise.resolve(undefined) : listProjectOwnerOptions(db),
    ]);

    const projects =
      admin != null
        ? stripCoverStoragePaths(await attachCoverSignedUrls(admin, projectsRaw))
        : projectsRaw;

    return NextResponse.json(
      { projects, ...(owners ? { owners } : {}) },
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
