import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";
import type { RunStartInput, TrajectoryEvent, TrajectoryPhase } from "./schema";

const SCHEMA_VERSION = "tbx.0.2";

export async function createTrajectoryRun(input: RunStartInput): Promise<{ runId: string; firstEvent: TrajectoryEvent }> {
  const runId = `run_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const firstEvent: TrajectoryEvent = {
    schema_version: SCHEMA_VERSION,
    task_id: input.task_id,
    run_id: runId,
    event_id: "evt_000001",
    seq: 1,
    ts: now,
    phase: "setup",
    event_type: "run_start",
    actor: "system",
    payload: {
      goal: input.goal,
      task_spec_ref: input.task_spec_ref,
      environment: input.environment,
      success_criteria: input.success_criteria,
    },
    meta: input.meta,
  };

  const runInsert = await supabase.from("trajectory_runs").insert({
    run_id: runId,
    task_id: input.task_id,
    schema_version: SCHEMA_VERSION,
    status: "running",
    last_seq: 1,
    created_at: now,
    updated_at: now,
  });
  if (runInsert.error) {
    throw new Error(`[trajectory] Failed to create run: ${runInsert.error.message}`);
  }

  const eventInsert = await supabase.from("trajectory_events").insert({
    run_id: runId,
    seq: 1,
    event: firstEvent,
  });
  if (eventInsert.error) {
    throw new Error(`[trajectory] Failed to insert first event: ${eventInsert.error.message}`);
  }

  return { runId, firstEvent };
}

export async function appendTrajectoryEvent(
  runId: string,
  eventInput: Omit<TrajectoryEvent, "seq" | "event_id" | "run_id" | "schema_version" | "ts">
): Promise<TrajectoryEvent> {
  const runLookup = await supabase
    .from("trajectory_runs")
    .select("run_id,task_id,status,last_seq")
    .eq("run_id", runId)
    .single();

  if (runLookup.error || !runLookup.data) {
    throw new Error(`Run ${runId} not found`);
  }

  const run = runLookup.data as {
    run_id: string;
    task_id: string;
    status: "running" | "finished";
    last_seq: number;
  };

  if (run.status !== "running") {
    throw new Error(`Run ${runId} is already finished`);
  }

  const seq = (run.last_seq ?? 0) + 1;
  const event: TrajectoryEvent = {
    ...eventInput,
    schema_version: SCHEMA_VERSION,
    run_id: runId,
    seq,
    event_id: `evt_${String(seq).padStart(6, "0")}`,
    ts: new Date().toISOString(),
  };

  if (event.task_id !== run.task_id) {
    throw new Error(`task_id mismatch for run ${runId}`);
  }

  const eventInsert = await supabase.from("trajectory_events").insert({
    run_id: runId,
    seq,
    event,
  });
  if (eventInsert.error) {
    throw new Error(`[trajectory] Failed to append event: ${eventInsert.error.message}`);
  }

  const nextStatus: "running" | "finished" = event.event_type === "run_end" ? "finished" : "running";
  const runUpdate = await supabase
    .from("trajectory_runs")
    .update({
      last_seq: seq,
      status: nextStatus,
      updated_at: event.ts,
    })
    .eq("run_id", runId);
  if (runUpdate.error) {
    throw new Error(`[trajectory] Failed to update run index: ${runUpdate.error.message}`);
  }

  return event;
}

export async function listTrajectoryRunEvents(runId: string): Promise<TrajectoryEvent[]> {
  const eventRows = await supabase
    .from("trajectory_events")
    .select("event,seq")
    .eq("run_id", runId)
    .order("seq", { ascending: true });

  if (eventRows.error) {
    throw new Error(`[trajectory] Failed to list run events: ${eventRows.error.message}`);
  }

  const rows = (eventRows.data ?? []) as Array<{ event: TrajectoryEvent; seq: number }>;
  return rows.map((row) => row.event);
}

/**
 * Find an existing running trajectory run for the given task_id, or create a new one.
 * This allows multiple modify executions on the same project to accumulate events
 * into a single run, producing a richer trajectory that satisfies quality thresholds.
 */
export async function findOrCreateTrajectoryRun(input: RunStartInput): Promise<{ runId: string; taskId: string; reused: boolean }> {
  // Look for an existing running run with the same task_id
  const existing = await supabase
    .from("trajectory_runs")
    .select("run_id,task_id,status,last_seq")
    .eq("task_id", input.task_id)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!existing.error && existing.data && existing.data.length > 0) {
    const row = existing.data[0] as { run_id: string; task_id: string };
    // Append a checkpoint event to mark the new modify round
    await appendTrajectoryEvent(row.run_id, {
      task_id: row.task_id,
      phase: "setup",
      event_type: "checkpoint",
      actor: "system",
      payload: {
        type: "new_modify_round",
        goal: input.goal,
        environment: input.environment,
      },
      meta: input.meta,
    });
    return { runId: row.run_id, taskId: row.task_id, reused: true };
  }

  // No existing running run — create a new one
  const { runId } = await createTrajectoryRun(input);
  return { runId, taskId: input.task_id, reused: false };
}

export async function createRunEndEvent(
  runId: string,
  taskId: string,
  actor: "agent" | "evaluator" | "system",
  payload: Record<string, unknown>,
  phase: TrajectoryPhase = "finalize"
): Promise<TrajectoryEvent> {
  return appendTrajectoryEvent(runId, {
    task_id: taskId,
    phase,
    event_type: "run_end",
    actor,
    payload,
    meta: {},
  });
}

export interface TrajectoryRunRecord {
  run_id: string;
  task_id: string;
  schema_version: string;
  status: "running" | "finished";
  last_seq: number;
  created_at: string;
  updated_at: string;
  ended_at?: string | null;
}

export interface EvaluatorRunRecord {
  id: string;
  run_id: string;
  verdict: "passed" | "failed" | "partial";
  score: Record<string, unknown>;
  failure_type: string | null;
  summary: string;
  created_at: string;
}

export async function listTrajectoryRuns(limit = 20, offset = 0): Promise<TrajectoryRunRecord[]> {
  const result = await supabase
    .from("trajectory_runs")
    .select("run_id,task_id,schema_version,status,last_seq,created_at,updated_at,ended_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + Math.max(0, limit - 1));

  if (result.error) {
    throw new Error(`[trajectory] Failed to list runs: ${result.error.message}`);
  }
  return (result.data ?? []) as TrajectoryRunRecord[];
}

export async function getTrajectoryRun(runId: string): Promise<TrajectoryRunRecord | null> {
  const result = await supabase
    .from("trajectory_runs")
    .select("run_id,task_id,schema_version,status,last_seq,created_at,updated_at,ended_at")
    .eq("run_id", runId)
    .single();

  if (result.error) {
    if (result.error.code === "PGRST116") return null;
    throw new Error(`[trajectory] Failed to fetch run: ${result.error.message}`);
  }
  return result.data as TrajectoryRunRecord;
}

export async function createEvaluatorRun(input: {
  runId: string;
  verdict: "passed" | "failed" | "partial";
  score: Record<string, unknown>;
  failureType?: string | null;
  summary: string;
}): Promise<EvaluatorRunRecord> {
  const result = await supabase
    .from("evaluator_runs")
    .insert({
      run_id: input.runId,
      verdict: input.verdict,
      score: input.score,
      failure_type: input.failureType ?? null,
      summary: input.summary,
    })
    .select("id,run_id,verdict,score,failure_type,summary,created_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(`[trajectory] Failed to create evaluator run: ${result.error?.message ?? "unknown error"}`);
  }
  return result.data as EvaluatorRunRecord;
}

export async function getLatestEvaluatorRun(runId: string): Promise<EvaluatorRunRecord | null> {
  const result = await supabase
    .from("evaluator_runs")
    .select("id,run_id,verdict,score,failure_type,summary,created_at")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (result.error) {
    throw new Error(`[trajectory] Failed to get evaluator run: ${result.error.message}`);
  }
  const row = (result.data ?? [])[0];
  return (row as EvaluatorRunRecord | undefined) ?? null;
}
