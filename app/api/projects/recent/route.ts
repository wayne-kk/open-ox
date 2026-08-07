import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { stripCoverStoragePaths } from "@/lib/projectCoverUrls";
import { listProjectsSummary } from "@/lib/projectManager";
import { RECENT_PROJECTS_LIMIT } from "@/lib/recentProjects";
import { listTagsByProjectIds } from "@/lib/tagManager";

/**
 * GET /api/projects/recent — owner's recently opened Studio projects (max 10).
 * Ordered by last_opened_at desc; excludes Recycle Bin and never-opened projects.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), RECENT_PROJECTS_LIMIT)
        : RECENT_PROJECTS_LIMIT;

    const projectsRaw = await listProjectsSummary(session.supabase, {
      userId: session.user.id,
      orderBy: "last_opened_at",
      limit,
    });

    const tagsByProject = await listTagsByProjectIds(
      session.supabase,
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
    console.error("[GET /api/projects/recent]", err);
    return NextResponse.json(
      { error: "Failed to load recent projects", code: "RECENT_ERROR" },
      { status: 500 }
    );
  }
}
