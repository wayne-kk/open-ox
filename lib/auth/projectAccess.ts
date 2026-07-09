import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth/roles";
import type { ProjectMetadata } from "@/lib/projectManager";
import { getProject } from "@/lib/projectManager";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export function isProjectOwner(
  project: Pick<ProjectMetadata, "ownerUserId">,
  userId: string
): boolean {
  return typeof project.ownerUserId === "string" && project.ownerUserId === userId;
}

export function forbiddenProjectResponse(): NextResponse {
  return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
}

export function projectNotFoundResponse(): NextResponse {
  return NextResponse.json(
    { error: "Project not found", code: "PROJECT_NOT_FOUND" },
    { status: 404 }
  );
}

/**
 * Static preview / cover access for non-owners.
 * Slice 01: owner or admin only. Slice 02 adds Publish Preview.
 */
export function canAccessStaticPreview(
  project: Pick<ProjectMetadata, "ownerUserId"> & { publishPreview?: boolean | null },
  opts: { userId: string | null; isAdmin?: boolean }
): boolean {
  if (opts.isAdmin) return true;
  if (opts.userId && isProjectOwner(project, opts.userId)) return true;
  if (project.publishPreview === true) return true;
  return false;
}

type Session = { supabase: SupabaseClient; user: User };

/**
 * Load a project the caller may mutate / open in Studio.
 * Owners use the session client (RLS). Admins may use service role when `allowAdmin` is true.
 */
export async function requireOwnedProject(
  session: Session,
  projectId: string,
  options?: { allowAdmin?: boolean }
): Promise<{ project: ProjectMetadata; db: SupabaseClient; isAdmin: boolean } | { error: NextResponse }> {
  const allowAdmin = options?.allowAdmin === true;
  let isAdmin = false;
  if (allowAdmin) {
    isAdmin = await isAdminUser({
      supabase: session.supabase,
      userId: session.user.id,
    });
  }

  const db = isAdmin ? createSupabaseServiceRoleClient() : session.supabase;
  const project = await getProject(db, projectId);
  if (!project) {
    return { error: projectNotFoundResponse() };
  }
  if (!isAdmin && !isProjectOwner(project, session.user.id)) {
    return { error: forbiddenProjectResponse() };
  }
  return { project, db, isAdmin };
}
