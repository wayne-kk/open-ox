import type { SupabaseClient } from "@supabase/supabase-js";

import { updateProjectStatus } from "@/lib/projectManager";

import type { GenerationRunPayloadBody } from "./types";

/** Returns queued/running run id for project, if any */
export async function getActiveQueuedOrRunningRunId(
  db: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data } = await db
    .from("generation_runs")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

export type EnqueueGenerationInput = {
  db: SupabaseClient;
  projectId: string;
  ownerUserId: string;
  kind: "new" | "retry" | "resume";
  resumeFromCheckpoint: boolean;
  payload: GenerationRunPayloadBody;
};

/**
 * Enqueue background generation or attach to existing queued/running run for same project.
 */
export async function enqueueGenerationJob(input: EnqueueGenerationInput): Promise<{
  runId: string;
  attached: boolean;
}> {
  const { db, projectId, ownerUserId, kind, resumeFromCheckpoint, payload } = input;

  const { data: activeRows } = await db
    .from("generation_runs")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"]);

  const existing = Array.isArray(activeRows) ? activeRows[0] : null;
  if (existing?.id) {
    return { runId: existing.id as string, attached: true };
  }

  const { data: inserted, error: insErr } = await db
    .from("generation_runs")
    .insert({
      project_id: projectId,
      user_id: ownerUserId,
      status: "queued",
      kind,
      resume_from_checkpoint: resumeFromCheckpoint,
      payload,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    throw new Error(insErr?.message ?? "[enqueueGenerationJob] insert failed");
  }

  const runId = inserted.id as string;

  await updateProjectStatus(db, projectId, "generating", {
    error: undefined,
    currentGenerationRunId: runId,
  });

  return { runId, attached: false };
}
