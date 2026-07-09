import { NextResponse } from "next/server";

import { listProjectsSummary } from "@/lib/projectManager";
import { attachCoverSignedUrls, stripCoverStoragePaths } from "@/lib/projectCoverUrls";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const COMMUNITY_LIST_MAX = 50;

/**
 * GET /api/community/projects — public Community list (Publish Preview + listed).
 * Query: offset, limit (capped).
 */
export async function GET(req: Request) {
  try {
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch {
      return NextResponse.json(
        { error: "Community list is not configured", code: "SERVICE_ROLE" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const rawLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 24;
    const limit = Math.min(rawLimit, COMMUNITY_LIST_MAX);

    const projectsRaw = await listProjectsSummary(admin, {
      communityListed: true,
      limit,
      offset,
    });

    const projects = stripCoverStoragePaths(await attachCoverSignedUrls(admin, projectsRaw));

    return NextResponse.json(
      { projects },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (err) {
    console.error("[GET /api/community/projects]", err);
    return NextResponse.json(
      { error: "Failed to load community projects", code: "COMMUNITY_LIST_ERROR" },
      { status: 500 }
    );
  }
}
