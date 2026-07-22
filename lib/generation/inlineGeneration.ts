import type { SupabaseClient } from "@supabase/supabase-js";

import { executeGenerationRun } from "@/lib/generation/executeGenerationRun";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import type { GenerationRunPayloadBody, GenerationRunRow } from "./types";
import {
  createInlineGenerationLease,
  generationLeaseSeconds,
  inlineGenerationWorkerId,
  shouldRunInlineGeneration,
} from "./executorMode";

export {
  createInlineGenerationLease,
  shouldRunInlineGeneration,
  shouldRunStandaloneGenerationWorker,
} from "./executorMode";

const INLINE_WORKER_ID = inlineGenerationWorkerId();

/**
 * Run leased jobs inside the Next.js process (no separate worker). Opt-in only:
 * set OPEN_OX_INLINE_GENERATION=1. Default is worker/queue mode.
 */
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

async function loadInlineOwnedRun(
  admin: SupabaseClient,
  runId: string
): Promise<GenerationRunRow | null> {
  const { data, error } = await admin
    .from("generation_runs")
    .select("*")
    .eq("id", runId)
    .eq("status", "running")
    .eq("lease_owner", INLINE_WORKER_ID)
    .maybeSingle();

  if (error) {
    console.error("[inline-generation] load owned run failed:", error.message);
    return null;
  }
  if (!data) return null;
  return mapDbRunToRow(data as Record<string, unknown>);
}

async function heartbeatInlineRun(
  admin: SupabaseClient,
  runId: string,
): Promise<void> {
  const lease = createInlineGenerationLease();
  const { error } = await admin
    .from("generation_runs")
    .update({
      lease_until: lease.lease_until,
      last_heartbeat_at: lease.last_heartbeat_at,
      updated_at: lease.updated_at,
    })
    .eq("id", runId)
    .eq("status", "running")
    .eq("lease_owner", INLINE_WORKER_ID);
  if (error) {
    console.warn("[inline-generation] heartbeat failed:", error.message);
  }
}

/**
 * Fire-and-forget: execute a run that enqueueGenerationJob already leased to
 * this process. The run is never visible as queued to shared/legacy workers.
 */
export function scheduleInlineGenerationRun(runId: string): void {
  if (!shouldRunInlineGeneration()) return;

  void (async () => {
    try {
      const admin = createSupabaseServiceRoleClient();
      const row = await loadInlineOwnedRun(admin, runId);
      if (!row) {
        console.info(
          `[inline-generation] skipped run ${runId} (not leased to this process)`
        );
        return;
      }
      console.info(`[inline-generation] executing run ${runId} in Next.js process`);
      const heartbeatTimer = setInterval(() => {
        void heartbeatInlineRun(admin, runId);
      }, Math.max(30_000, (generationLeaseSeconds() * 1000) / 2));
      try {
        await executeGenerationRun({
          admin,
          run: row,
          workerHostname: INLINE_WORKER_ID,
        });
      } finally {
        clearInterval(heartbeatTimer);
      }
    } catch (err) {
      console.error(
        "[inline-generation] execute failed:",
        err instanceof Error ? err.message : err
      );
    }
  })();
}
