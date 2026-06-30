import type { SupabaseClient } from "@supabase/supabase-js";

import { executeGenerationRun } from "@/lib/generation/executeGenerationRun";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import type { GenerationRunPayloadBody, GenerationRunRow } from "./types";

const INLINE_WORKER_ID = "inline-next-dev";

/**
 * Run queued jobs inside the Next.js process (no separate worker). Opt-in only:
 * set OPEN_OX_INLINE_GENERATION=1. Default is worker/queue mode.
 */
export function shouldRunInlineGeneration(): boolean {
  const flag = process.env.OPEN_OX_INLINE_GENERATION?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function mapDbRunToRow(data: Record<string, unknown>): GenerationRunRow {
  return {
    id: String(data.id),
    project_id: String(data.project_id),
    status: String(data.status),
    kind: String(data.kind),
    resume_from_checkpoint: Boolean(data.resume_from_checkpoint),
    payload: data.payload as GenerationRunPayloadBody,
  };
}

async function claimRunForInline(
  admin: SupabaseClient,
  runId: string
): Promise<GenerationRunRow | null> {
  const leaseSeconds = Math.max(
    60,
    Number.parseInt(process.env.OPEN_OX_GENERATION_LEASE_SECONDS ?? "240", 10) || 240
  );
  const now = new Date().toISOString();
  const until = new Date(Date.now() + leaseSeconds * 1000).toISOString();

  const { data, error } = await admin
    .from("generation_runs")
    .update({
      status: "running",
      lease_owner: INLINE_WORKER_ID,
      lease_until: until,
      last_heartbeat_at: now,
      started_at: now,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[inline-generation] claim failed:", error.message);
    return null;
  }
  if (!data) return null;
  return mapDbRunToRow(data as Record<string, unknown>);
}

/**
 * Fire-and-forget: claim `runId` if still queued, then execute in-process.
 */
export function scheduleInlineGenerationRun(runId: string): void {
  if (!shouldRunInlineGeneration()) return;

  void (async () => {
    try {
      const admin = createSupabaseServiceRoleClient();
      const row = await claimRunForInline(admin, runId);
      if (!row) {
        console.info(
          `[inline-generation] skipped run ${runId} (not queued — worker may own it)`
        );
        return;
      }
      console.info(`[inline-generation] executing run ${runId} in Next.js process`);
      await executeGenerationRun({
        admin,
        run: row,
        workerHostname: INLINE_WORKER_ID,
      });
    } catch (err) {
      console.error(
        "[inline-generation] execute failed:",
        err instanceof Error ? err.message : err
      );
    }
  })();
}
