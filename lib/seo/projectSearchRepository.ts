import { cache } from "react";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { ProjectMetadata } from "@/lib/projectManager";
import { getProject } from "@/lib/projectManager";
import { isProjectPublicShowcase } from "./publishedProject";

export const getPublicShowcaseProject = cache(async (id: string): Promise<ProjectMetadata | null> => {
  let db;
  try {
    db = createSupabaseServiceRoleClient();
  } catch {
    return null;
  }
  const project = await getProject(db, id);
  return project && isProjectPublicShowcase(project) ? project : null;
});

export type ProjectSitemapRow = {
  id: string;
  name: string;
  seoSlug: string | null;
  seoUpdatedAt: string;
  coverImageUpdatedAt: string | null;
};

function configuredDb() {
  let db;
  try {
    db = createSupabaseServiceRoleClient();
  } catch {
    return null;
  }
  return db;
}

export const PROJECTS_PER_SITEMAP = 10_000;

export type ProjectSitemapShard = { page: number; afterId: string | null };

export async function listProjectSitemapShards(): Promise<ProjectSitemapShard[]> {
  const db = configuredDb();
  if (!db) return [];
  const { data, error } = await db.rpc("list_search_sitemap_shards", {
    shard_size: PROJECTS_PER_SITEMAP,
  });
  if (error) throw new Error(`[seo] sitemap shard query failed: ${error.message}`);
  return (data ?? []).map((row: { page: number; after_id: string | null }) => ({
    page: row.page,
    afterId: row.after_id,
  }));
}

export async function listIndexableProjectsForSitemap(
  shard: ProjectSitemapShard
): Promise<ProjectSitemapRow[]> {
  const db = configuredDb();
  if (!db) return [];

  let query = db
    .from("search_indexable_projects")
    .select("id,name,seo_slug,seo_updated_at,updated_at,cover_image_updated_at")
    .order("id", { ascending: true })
    .limit(PROJECTS_PER_SITEMAP);
  if (shard.afterId) query = query.gt("id", shard.afterId);
  const { data, error } = await query;

  if (error) {
    throw new Error(`[seo] project sitemap query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    seoSlug: typeof row.seo_slug === "string" ? row.seo_slug : null,
    seoUpdatedAt: String(row.seo_updated_at ?? row.updated_at),
    coverImageUpdatedAt:
      typeof row.cover_image_updated_at === "string" ? row.cover_image_updated_at : null,
  }));
}
