import { NextResponse } from "next/server";
import type { GenerationMode, ProjectFolderFilter } from "@/lib/projectManager";
import { createProject, listProjectsSummary } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const ANON_LIST_MAX = 50;

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

    /** Only your projects + folder filters (“我的”视图). Default landing is global (everyone). */
    const listMine =
      mine ||
      folderParam === "uncategorized" ||
      (folderParam !== "all" && folderParam.length > 0);

    const session = await getSessionUser();

    if (!session) {
      if (listMine) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }
      let admin;
      try {
        admin = createSupabaseServiceRoleClient();
      } catch {
        return NextResponse.json(
          { error: "Public project list is not configured", code: "SERVICE_ROLE" },
          { status: 503 }
        );
      }
      const rawLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;
      const limit =
        rawLimit !== undefined ? Math.min(rawLimit, ANON_LIST_MAX) : undefined;
      const projects = await listProjectsSummary(admin, {
        filterOwnerUserId:
          ownerFilter && /^[0-9a-f-]{36}$/i.test(ownerFilter) ? ownerFilter : null,
        limit,
        offset,
      });
      return NextResponse.json(projects);
    }

    const { supabase: db } = session;

    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

    const projects = await listProjectsSummary(db, {
      ...(listMine
        ? { userId: session.user.id, folder }
        : {
            filterOwnerUserId:
              ownerFilter && /^[0-9a-f-]{36}$/i.test(ownerFilter) ? ownerFilter : null,
          }),
      limit,
      offset,
    });
    return NextResponse.json(projects);
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to list projects", code: "LIST_PROJECTS_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { supabase: db, user } = session;

    const body = await req.json();
    const { userPrompt, modelId, folderId, generationMode, imageBase64 } = body as {
      userPrompt: string;
      modelId?: string;
      folderId?: string | null;
      generationMode?: GenerationMode;
      imageBase64?: string;
    };
    if (generationMode !== undefined && generationMode !== "web") {
      return NextResponse.json({ error: "Invalid generationMode" }, { status: 400 });
    }
    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
    }
    const project = await createProject(db, {
      userPrompt: userPrompt.trim(),
      userId: user.id,
      ownerUsername: getUserDisplayName(user),
      modelId,
      folderId: folderId ?? null,
      generationMode,
      ...(typeof imageBase64 === "string" && imageBase64.trim()
        ? { referenceImageDataUrl: imageBase64.trim() }
        : {}),
    });
    return NextResponse.json({ projectId: project.id });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
