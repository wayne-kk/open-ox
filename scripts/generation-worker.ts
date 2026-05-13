/**
 * Long-running generation worker. Run alongside Next (Docker service or second terminal).
 *
 *   OPEN_OX_WORKER_ID=host-1 pnpm run generation:worker
 */
import { hostname } from "node:os";

import { loadEnvConfig } from "@next/env";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { executeGenerationRun } from "@/lib/generation/executeGenerationRun";
import type { GenerationRunRow } from "@/lib/generation/types";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const WORKER_ID =
  process.env.OPEN_OX_WORKER_ID ?? `${hostname()}-${process.pid}`;
const LEASE_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.OPEN_OX_GENERATION_LEASE_SECONDS ?? "240", 10) || 240
);
const POLL_MS = Math.max(
  500,
  Number.parseInt(process.env.OPEN_OX_GENERATION_POLL_MS ?? "1500", 10) || 1500
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function heartbeat(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  runId: string
): Promise<void> {
  const until = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const now = new Date().toISOString();
  await admin
    .from("generation_runs")
    .update({
      lease_until: until,
      last_heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("lease_owner", WORKER_ID);
}

export async function runWorkerLoop(signal: AbortSignal): Promise<void> {
  const admin = createSupabaseServiceRoleClient();
  console.info(
    `[generation-worker] started id=${WORKER_ID} lease=${LEASE_SECONDS}s poll=${POLL_MS}ms`
  );

  while (!signal.aborted) {
    const { data: rows, error } = await admin.rpc("claim_next_generation_run", {
      p_worker: WORKER_ID,
      p_lease_seconds: LEASE_SECONDS,
    });

    if (error) {
      console.error("[generation-worker] claim failed:", error.message);
      await sleep(POLL_MS);
      continue;
    }

    const row = Array.isArray(rows) ? (rows[0] as GenerationRunRow | undefined) : undefined;
    if (!row?.id) {
      await sleep(POLL_MS);
      continue;
    }

    const hbTimer = setInterval(() => {
      void heartbeat(admin, row.id).catch((err) =>
        console.warn("[generation-worker] heartbeat failed:", err)
      );
    }, Math.max(30_000, (LEASE_SECONDS * 1000) / 2));

    try {
      await executeGenerationRun({
        admin,
        run: row,
        workerHostname: WORKER_ID,
      });
    } catch (err) {
      console.error("[generation-worker] execute failed:", err);
    } finally {
      clearInterval(hbTimer);
    }
  }
}

const ac = new AbortController();
process.on("SIGINT", () => ac.abort());
process.on("SIGTERM", () => ac.abort());

runWorkerLoop(ac.signal).catch((err) => {
  console.error("[generation-worker] fatal:", err);
  process.exitCode = 1;
});
