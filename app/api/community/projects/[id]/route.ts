import { NextRequest, NextResponse } from "next/server";

import {
  canAccessStaticPreview,
  forbiddenProjectResponse,
  projectNotFoundResponse,
} from "@/lib/auth/projectAccess";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { getProject } from "@/lib/projectManager";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/community/projects/[id] — public Community card detail (no Studio payload).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured", code: "SERVICE_ROLE" }, { status: 503 });
  }

  const project = await getProject(admin, id);
  if (!project) return projectNotFoundResponse();

  const session = await getSessionUser();
  const isAdmin = session
    ? await isAdminUser({ supabase: session.supabase, userId: session.user.id })
    : false;

  if (
    !canAccessStaticPreview(project, {
      userId: session?.user.id ?? null,
      isAdmin,
    })
  ) {
    return forbiddenProjectResponse();
  }

  return NextResponse.json({
    id: project.id,
    name: project.name,
    status: project.status,
    ownerUsername: project.ownerUsername ?? null,
    coverImageStatus: project.coverImageStatus ?? null,
    publishPreview: project.publishPreview === true,
    allowRemix: project.allowRemix === true,
    remixedFromTitle: project.remixedFromTitle ?? null,
    remixedFromOwnerUsername: project.remixedFromOwnerUsername ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}
