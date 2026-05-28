import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProjectMetadata } from "@/lib/projectManager";

const BUCKET = "project-files";
const SIGNED_URL_TTL_SEC = 3600;

export type ProjectListItem = ProjectMetadata & {
  /** Short-lived signed Storage URL — use as `<img src>` to skip per-card `/cover` API hops. */
  coverImageUrl?: string;
};

function coverStoragePath(projectId: string, relativePath: string): string | null {
  const rel = relativePath.trim().replace(/^\/+/, "");
  if (!rel || rel.includes("..") || rel.includes(":")) return null;
  return `${projectId}/${rel}`.replace(/\\/g, "/");
}

/** Batch-sign cover JPEGs for list/gallery responses (one Storage round trip). */
export async function attachCoverSignedUrls(
  admin: SupabaseClient,
  projects: ProjectMetadata[]
): Promise<ProjectListItem[]> {
  const indexed: { index: number; storagePath: string }[] = [];

  for (let i = 0; i < projects.length; i += 1) {
    const p = projects[i];
    if (p.coverImageStatus !== "ready" || !p.coverImageStoragePath?.trim()) continue;
    const storagePath = coverStoragePath(p.id, p.coverImageStoragePath);
    if (!storagePath) continue;
    indexed.push({ index: i, storagePath });
  }

  if (indexed.length === 0) {
    return projects.map((p) => ({ ...p }));
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(
      indexed.map((row) => row.storagePath),
      SIGNED_URL_TTL_SEC
    );

  if (error || !data) {
    return projects.map((p) => ({ ...p }));
  }

  const out: ProjectListItem[] = projects.map((p) => ({ ...p }));
  for (let j = 0; j < indexed.length; j += 1) {
    const signedUrl = data[j]?.signedUrl;
    if (signedUrl) {
      out[indexed[j].index] = { ...out[indexed[j].index], coverImageUrl: signedUrl };
    }
  }
  return out;
}

/** Strip internal storage paths from list payloads sent to the browser. */
export function stripCoverStoragePaths(items: ProjectListItem[]): ProjectListItem[] {
  return items.map(({ coverImageStoragePath: _path, ...rest }) => rest);
}
