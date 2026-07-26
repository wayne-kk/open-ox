import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenerationRunRow } from "./types";

function formatRpcError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const row = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  return [row.message, row.details, row.hint, row.code].filter(Boolean).join(" | ") ||
    "unknown RPC error";
}

export async function claimGenerationRunById(
  admin: SupabaseClient,
  input: { runId: string; workerId: string; leaseSeconds: number },
): Promise<GenerationRunRow | null> {
  const { data, error } = await admin.rpc("claim_generation_run_by_id", {
    p_run_id: input.runId,
    p_worker: input.workerId,
    p_lease_seconds: input.leaseSeconds,
  });
  if (error) throw new Error(formatRpcError(error));
  return Array.isArray(data) && data[0]
    ? (data[0] as GenerationRunRow)
    : null;
}

export async function loadRecoverableGenerationRunIds(
  admin: SupabaseClient,
  now = new Date(),
): Promise<string[]> {
  const [queued, expired] = await Promise.all([
    admin.from("generation_runs").select("id").eq("status", "queued").limit(1_000),
    admin
      .from("generation_runs")
      .select("id")
      .eq("status", "running")
      .lt("lease_until", now.toISOString())
      .limit(1_000),
  ]);
  if (queued.error) throw new Error(formatRpcError(queued.error));
  if (expired.error) throw new Error(formatRpcError(expired.error));
  return Array.from(
    new Set(
      [...(queued.data ?? []), ...(expired.data ?? [])].map((row) => String(row.id)),
    ),
  );
}
