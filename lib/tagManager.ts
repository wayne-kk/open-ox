import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_TAG_NAME_LENGTH = 32;
export const MAX_TAGS_PER_PROJECT = 20;

export interface ProjectTagRow {
  id: string;
  name: string;
  createdAt: string;
}

/** Trim + collapse whitespace; null when empty after sanitize. */
export function normalizeTagName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

/**
 * Workspace text search: trim, length-cap, strip PostgREST/ilike metacharacters
 * so the value is a literal substring match.
 */
export function normalizeGallerySearchQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * When searching or filtering by tag on the default "all" / root folder view,
 * include every owned project (any folder). A concrete folder uuid still scopes.
 */
export function shouldSearchAcrossFolders(
  folder: string | undefined,
  hasSearch: boolean,
  hasTagFilter = false
): boolean {
  if (!hasSearch && !hasTagFilter) return false;
  return !folder || folder === "all" || folder === "uncategorized";
}

export async function listTags(db: SupabaseClient, userId: string): Promise<ProjectTagRow[]> {
  const { data, error } = await db
    .from("project_tags")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    console.error("[tagManager] listTags:", error.message);
    return [];
  }
  return (data as { id: string; name: string; created_at: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

export async function createTag(
  db: SupabaseClient,
  userId: string,
  name: string
): Promise<ProjectTagRow> {
  const normalized = normalizeTagName(name);
  if (!normalized) throw new Error("Tag name is required");
  const { data, error } = await db
    .from("project_tags")
    .insert({ user_id: userId, name: normalized })
    .select("id,name,created_at")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new Error("Tag already exists");
    throw new Error(error?.message ?? "Failed to create tag");
  }
  const row = data as { id: string; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function renameTag(
  db: SupabaseClient,
  userId: string,
  tagId: string,
  name: string
): Promise<ProjectTagRow> {
  const normalized = normalizeTagName(name);
  if (!normalized) throw new Error("Tag name is required");
  const { data, error } = await db
    .from("project_tags")
    .update({ name: normalized })
    .eq("id", tagId)
    .eq("user_id", userId)
    .select("id,name,created_at")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") throw new Error("Tag already exists");
    throw new Error(error.message);
  }
  if (!data) throw new Error("Tag not found");
  const row = data as { id: string; name: string; created_at: string };
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function deleteTag(
  db: SupabaseClient,
  userId: string,
  tagId: string
): Promise<void> {
  const { error } = await db
    .from("project_tags")
    .delete()
    .eq("id", tagId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getOwnedTagIds(
  db: SupabaseClient,
  userId: string,
  tagIds: string[]
): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const { data, error } = await db
    .from("project_tags")
    .select("id")
    .eq("user_id", userId)
    .in("id", tagIds);
  if (error) throw new Error(error.message);
  return (data as { id: string }[]).map((r) => r.id);
}

/** Replace a project's tag set. Tags must already belong to `userId`. */
export async function setProjectTags(
  db: SupabaseClient,
  userId: string,
  projectId: string,
  tagIds: string[]
): Promise<ProjectTagRow[]> {
  const unique = [...new Set(tagIds.filter((id) => typeof id === "string" && id.trim()))];
  if (unique.length > MAX_TAGS_PER_PROJECT) {
    throw new Error(`At most ${MAX_TAGS_PER_PROJECT} tags per project`);
  }

  const owned = await getOwnedTagIds(db, userId, unique);
  if (owned.length !== unique.length) {
    throw new Error("One or more tags were not found");
  }

  const { error: delErr } = await db
    .from("project_tag_links")
    .delete()
    .eq("project_id", projectId);
  if (delErr) throw new Error(delErr.message);

  if (owned.length > 0) {
    const { error: insErr } = await db.from("project_tag_links").insert(
      owned.map((tag_id) => ({ project_id: projectId, tag_id }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  return listTagsForProject(db, projectId);
}

export async function listTagsForProject(
  db: SupabaseClient,
  projectId: string
): Promise<ProjectTagRow[]> {
  const { data, error } = await db
    .from("project_tag_links")
    .select("tag_id, project_tags(id, name, created_at)")
    .eq("project_id", projectId);
  if (error) {
    console.error("[tagManager] listTagsForProject:", error.message);
    return [];
  }
  return mapLinkRowsToTags(data);
}

export async function listTagsByProjectIds(
  db: SupabaseClient,
  projectIds: string[]
): Promise<Map<string, ProjectTagRow[]>> {
  const result = new Map<string, ProjectTagRow[]>();
  if (projectIds.length === 0) return result;

  const { data, error } = await db
    .from("project_tag_links")
    .select("project_id, tag_id, project_tags(id, name, created_at)")
    .in("project_id", projectIds);
  if (error) {
    console.error("[tagManager] listTagsByProjectIds:", error.message);
    return result;
  }

  for (const row of data ?? []) {
    const projectId = (row as { project_id: string }).project_id;
    const tags = mapLinkRowsToTags([row]);
    const existing = result.get(projectId) ?? [];
    existing.push(...tags);
    result.set(projectId, existing);
  }

  for (const [id, tags] of result) {
    tags.sort((a, b) => a.name.localeCompare(b.name));
    result.set(id, tags);
  }
  return result;
}

export async function listProjectIdsWithTag(
  db: SupabaseClient,
  tagId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("project_tag_links")
    .select("project_id")
    .eq("tag_id", tagId);
  if (error) {
    console.error("[tagManager] listProjectIdsWithTag:", error.message);
    return [];
  }
  return (data as { project_id: string }[]).map((r) => r.project_id);
}

function mapLinkRowsToTags(data: unknown): ProjectTagRow[] {
  if (!Array.isArray(data)) return [];
  const tags: ProjectTagRow[] = [];
  for (const row of data) {
    const nested = (row as { project_tags?: unknown }).project_tags;
    const tag = Array.isArray(nested) ? nested[0] : nested;
    if (
      tag &&
      typeof tag === "object" &&
      typeof (tag as { id?: unknown }).id === "string" &&
      typeof (tag as { name?: unknown }).name === "string"
    ) {
      const t = tag as { id: string; name: string; created_at?: string };
      tags.push({
        id: t.id,
        name: t.name,
        createdAt: t.created_at ?? "",
      });
    }
  }
  tags.sort((a, b) => a.name.localeCompare(b.name));
  return tags;
}
