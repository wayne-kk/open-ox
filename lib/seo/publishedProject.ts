import { withLocalePrefix } from "@/lib/i18n/localePath";

export type SearchIndexableProject = {
  id: string;
  name: string;
  publishPreview?: boolean | null;
  listing?: "listed" | "unlisted" | null;
  searchIndexingEnabled?: boolean | null;
  staticPreviewSyncedAt?: string | null;
  deletedAt?: string | null;
  seoSlug?: string | null;
};

export function projectSeoSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "project";
}

export function isProjectIndexable(project: SearchIndexableProject): boolean {
  return (
    project.publishPreview === true &&
    project.listing === "listed" &&
    project.searchIndexingEnabled === true &&
    Boolean(project.staticPreviewSyncedAt) &&
    !project.deletedAt
  );
}

export function isProjectPublicShowcase(project: SearchIndexableProject): boolean {
  return (
    project.publishPreview === true &&
    project.listing === "listed" &&
    Boolean(project.staticPreviewSyncedAt) &&
    !project.deletedAt
  );
}

export function projectShowcasePath(project: Pick<SearchIndexableProject, "id" | "name" | "seoSlug">): string {
  const slug = project.seoSlug?.trim() || projectSeoSlug(project.name);
  return `/showcase/${encodeURIComponent(project.id)}/${encodeURIComponent(slug)}`;
}

export function indexableProjectUrl(
  project: Pick<SearchIndexableProject, "id" | "name" | "seoSlug">,
  locale: string,
  origin: string
): string {
  return `${origin}${withLocalePrefix(projectShowcasePath(project), locale)}`;
}
