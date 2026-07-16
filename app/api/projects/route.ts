import { NextResponse } from "next/server";
import type { GenerationMode, ProjectFolderFilter } from "@/lib/projectManager";
import { createProject, listProjectsSummary } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";
import {
  listTagsByProjectIds,
  normalizeGallerySearchQuery,
} from "@/lib/tagManager";

/**
 * GET /api/projects — current user's Workspace projects only.
 * Query: offset, limit, folder (`all` | `uncategorized` | folder uuid),
 * published (`1` = only publish_preview, any folder; ignores folder),
 * q (name / prompt search), tag (tag uuid filter).
 * `all` / `uncategorized` = root only (`folder_id` null), unless `q` is set.
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
    const searchQuery = normalizeGallerySearchQuery(searchParams.get("q"));
    const tagIdRaw = (searchParams.get("tag") || "").trim();
    const tagId = tagIdRaw || null;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : undefined;

    let folder: ProjectFolderFilter = "all";
    if (folderParam === "uncategorized") folder = "uncategorized";
    else if (folderParam !== "all") folder = folderParam;

    const projectsRaw = await listProjectsSummary(session.supabase, {
      userId: session.user.id,
      ...(publishedOnly ? { publishedOnly: true } : { folder }),
      ...(searchQuery ? { searchQuery } : {}),
      ...(tagId ? { tagId } : {}),
      limit,
      offset,
    });
    const tagsByProject = await listTagsByProjectIds(
      session.supabase,
      projectsRaw.map((p) => p.id)
    );
    const projects = projectsRaw.map((p) => ({
      ...p,
      tags: tagsByProject.get(p.id) ?? [],
    }));
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
