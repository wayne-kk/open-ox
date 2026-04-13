import { NextResponse } from "next/server";
import type { ProjectFolderFilter } from "@/lib/projectManager";
import { createProject, listProjectsSummary } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { supabase: db } = session;

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const folderParam = (searchParams.get("folder") || "all").trim() || "all";
    const mine = searchParams.get("mine") === "1";
    const ownerFilter = searchParams.get("owner");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;

    let folder: ProjectFolderFilter = "all";
    if (folderParam === "uncategorized") folder = "uncategorized";
    else if (folderParam !== "all") folder = folderParam;

    /** Only your projects + folder filters (“我的”视图). Default landing is global (everyone). */
    const listMine =
      mine ||
      folderParam === "uncategorized" ||
      (folderParam !== "all" && folderParam.length > 0);

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
    const { userPrompt, modelId, styleGuide, folderId } = body as {
      userPrompt: string;
      modelId?: string;
      styleGuide?: string;
      folderId?: string | null;
    };
    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
    }
    const project = await createProject(db, {
      userPrompt: userPrompt.trim(),
      userId: user.id,
      ownerUsername: getUserDisplayName(user),
      modelId,
      folderId: folderId ?? null,
    });
    return NextResponse.json({ projectId: project.id, styleGuide: styleGuide ?? null });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
