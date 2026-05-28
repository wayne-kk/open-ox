import type { SupabaseClient } from "@supabase/supabase-js";

interface ProjectOwnerRow {
  user_id: string | null;
  owner_username: string | null;
  created_at: string;
}

export interface ProjectOwnerOption {
  id: string;
  label: string;
}

/**
 * Returns distinct owners for global gallery member filter.
 * Single descending scan + in-memory dedupe (one DB round trip).
 */
export async function listProjectOwnerOptions(
  db: SupabaseClient,
  options?: {
    maxOwners?: number;
    maxScanRows?: number;
  }
): Promise<ProjectOwnerOption[]> {
  const maxOwners =
    typeof options?.maxOwners === "number" && Number.isFinite(options.maxOwners) && options.maxOwners > 0
      ? Math.floor(options.maxOwners)
      : 300;
  const maxScanRows =
    typeof options?.maxScanRows === "number" &&
    Number.isFinite(options.maxScanRows) &&
    options.maxScanRows > 0
      ? Math.floor(options.maxScanRows)
      : 2500;

  const { data, error } = await db
    .from("projects")
    .select("user_id,owner_username,created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(maxScanRows);

  if (error) {
    console.error("[projectOwnerOptions] listProjectOwnerOptions error:", error.message);
    return [];
  }

  const dedup = new Map<string, string>();
  for (const row of (data ?? []) as ProjectOwnerRow[]) {
    const userId = row.user_id;
    if (!userId || dedup.has(userId)) continue;
    const label = row.owner_username?.trim() || `${userId.slice(0, 8)}…`;
    dedup.set(userId, label);
    if (dedup.size >= maxOwners) break;
  }

  return [...dedup.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}
