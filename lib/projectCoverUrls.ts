import type { ProjectMetadata } from "@/lib/projectManager";

export type ProjectListItem = ProjectMetadata;

/** Strip internal storage paths from list payloads sent to the browser. */
export function stripCoverStoragePaths(items: ProjectListItem[]): ProjectListItem[] {
  return items.map(({ coverImageStoragePath: _path, ...rest }) => rest);
}

/** Versioned cover URL for Workspace / Community cards (`?v=` busts browser cache after recapture). */
export function projectCoverDisplayUrl(
  projectId: string,
  coverImageUpdatedAt?: string | null
): string {
  const base = `/api/projects/${projectId}/cover`;
  const v = coverImageUpdatedAt?.trim();
  if (!v) return base;
  return `${base}?v=${encodeURIComponent(v)}`;
}
