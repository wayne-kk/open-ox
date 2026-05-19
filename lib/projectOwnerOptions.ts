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
 * Scans recent project rows in batches and deduplicates by `user_id`.
 */
export async function listProjectOwnerOptions(
  db: SupabaseClient,
  options?: {
    maxOwners?: number;
    scanBatchSize?: number;
    maxScanRows?: number;
  }
): Promise<ProjectOwnerOption[]> {
  const maxOwners =
    typeof options?.maxOwners === "number" && Number.isFinite(options.maxOwners) && options.maxOwners > 0
      ? Math.floor(options.maxOwners)
      : 300;
  const scanBatchSize =
    typeof options?.scanBatchSize === "number" &&
    Number.isFinite(options.scanBatchSize) &&
    options.scanBatchSize > 0
      ? Math.floor(options.scanBatchSize)
      : 300;
  const maxScanRows =
    typeof options?.maxScanRows === "number" &&
    Number.isFinite(options.maxScanRows) &&
    options.maxScanRows > 0
      ? Math.floor(options.maxScanRows)
      : 6000;

  const dedup = new Map<string, string>();
  let offset = 0;

  while (offset < maxScanRows && dedup.size < maxOwners) {
    const { data, error } = await db
      .from("projects")
      .select("user_id,owner_username,created_at")
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + scanBatchSize - 1);

    if (error) {
      console.error("[projectOwnerOptions] listProjectOwnerOptions error:", error.message);
      break;
    }

    const rows = (data ?? []) as ProjectOwnerRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const userId = row.user_id;
      if (!userId || dedup.has(userId)) continue;
      const label = row.owner_username?.trim() || `${userId.slice(0, 8)}…`;
      dedup.set(userId, label);
      if (dedup.size >= maxOwners) break;
    }

    if (rows.length < scanBatchSize) break;
    offset += rows.length;
  }

  return [...dedup.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}
