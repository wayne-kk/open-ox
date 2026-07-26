/**
 * Long-running generation worker. Run alongside Next (Docker service or second terminal).
 *
 *   OPEN_OX_WORKER_ID=host-1 pnpm run generation:worker
 *
 * Local dev: run `pnpm run generation:worker` alongside `pnpm dev`.
 * Optional: OPEN_OX_INLINE_GENERATION=1 runs jobs inside Next.js instead of this worker.
 */
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { Queue, Worker } from "bullmq";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createResilientFetch } from "@/lib/supabase/resilientFetch";
import { executeGenerationRun } from "@/lib/generation/executeGenerationRun";
import {
  createGenerationRedisConnection,
  GENERATION_QUEUE_NAME,
} from "@/lib/generation/generationQueue";
import { shouldRunStandaloneGenerationWorker } from "@/lib/generation/inlineGeneration";
import {
  claimGenerationRunById,
  loadRecoverableGenerationRunIds,
} from "@/lib/generation/workerQueue";

/**
 * Load `.env*` into `process.env` without overriding existing keys.
 * Avoids `@next/env` so the Docker-bundled worker does not need Next's package graph.
 * Compose/K8s already inject env; this mainly helps local `pnpm run generation:worker`.
 */
function loadEnvFiles(dir: string): void {
  const files =
    process.env.NODE_ENV === "production"
      ? [".env.production.local", ".env.local", ".env.production", ".env"]
      : [".env.development.local", ".env.local", ".env.development", ".env"];
  for (const name of files) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const projectDir = process.cwd();
loadEnvFiles(projectDir);

const WORKER_ID =
  process.env.OPEN_OX_WORKER_ID ?? `${hostname()}-${process.pid}`;
const LEASE_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.OPEN_OX_GENERATION_LEASE_SECONDS ?? "240", 10) || 240
);
const RECOVERY_MS = Math.max(
  30_000,
  Number.parseInt(
    process.env.OPEN_OX_GENERATION_RECOVERY_MS ?? "300000",
    10,
  ) || 300_000,
);

function supabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "(NEXT_PUBLIC_SUPABASE_URL missing)";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function verifySupabaseReachable(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>
): Promise<boolean> {
  try {
    const { error } = await admin.from("generation_runs").select("id").limit(1);
    if (error) {
      console.error("[generation-worker] Supabase ping failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && err.cause
          ? String(err.cause)
          : "";
    console.error(
      "[generation-worker] Supabase ping threw:",
      cause ? `${msg} — cause: ${cause}` : msg
    );
    return false;
  }
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
  if (!shouldRunStandaloneGenerationWorker()) {
    console.warn(
      "[generation-worker] disabled because OPEN_OX_INLINE_GENERATION is enabled"
    );
    return;
  }

  const admin = createSupabaseServiceRoleClient({
    global: { fetch: createResilientFetch(3) },
  });
  console.info(
    `[generation-worker] started id=${WORKER_ID} lease=${LEASE_SECONDS}s queue=redis recovery=${RECOVERY_MS}ms supabase=${supabaseHost()}`,
  );

  const reachable = await verifySupabaseReachable(admin);
  if (!reachable) {
    console.error(
      "[generation-worker] Cannot reach Supabase. Check VPN/proxy, NEXT_PUBLIC_SUPABASE_URL, " +
        "SUPABASE_SERVICE_ROLE_KEY, and that the project is not paused. Retrying…"
    );
  }

  const queueConnection = createGenerationRedisConnection();
  const workerConnection = createGenerationRedisConnection({ worker: true });
  const queue = new Queue<{ runId: string }>(GENERATION_QUEUE_NAME, {
    connection: queueConnection,
  });

  const recover = async () => {
    const runIds = await loadRecoverableGenerationRunIds(admin);
    if (runIds.length === 0) return;
    await queue.addBulk(
      runIds.map((runId) => ({
        name: "execute",
        data: { runId },
        opts: {
          jobId: runId,
          attempts: 5,
          backoff: { type: "exponential" as const, delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      })),
    );
    console.info(`[generation-worker] recovered ${runIds.length} database run(s)`);
  };

  const worker = new Worker<{ runId: string }>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      const row = await claimGenerationRunById(admin, {
        runId: job.data.runId,
        workerId: WORKER_ID,
        leaseSeconds: LEASE_SECONDS,
      });
      if (!row) return;

      const hbTimer = setInterval(() => {
        void heartbeat(admin, row.id).catch((err) =>
          console.warn("[generation-worker] heartbeat failed:", err),
        );
      }, Math.max(30_000, (LEASE_SECONDS * 1000) / 2));
      try {
        await executeGenerationRun({
          admin,
          run: row,
          workerHostname: WORKER_ID,
        });
      } finally {
        clearInterval(hbTimer);
      }
    },
    { connection: workerConnection, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[generation-worker] job ${job?.id ?? "unknown"} failed:`,
      err.message,
    );
  });
  worker.on("error", (err) => {
    console.error("[generation-worker] Redis worker error:", err.message);
  });

  await recover();
  const recoveryTimer = setInterval(() => {
    void recover().catch((err) =>
      console.error("[generation-worker] recovery scan failed:", err),
    );
  }, RECOVERY_MS);

  await new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
  });

  clearInterval(recoveryTimer);
  await worker.close();
  await queue.close();
  await Promise.allSettled([workerConnection.quit(), queueConnection.quit()]);
}

const ac = new AbortController();
process.on("SIGINT", () => ac.abort());
process.on("SIGTERM", () => ac.abort());

runWorkerLoop(ac.signal).catch((err) => {
  console.error("[generation-worker] fatal:", err);
  process.exitCode = 1;
});
