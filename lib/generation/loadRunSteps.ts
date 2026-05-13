import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuildStep } from "@/ai/flows";

import { foldBuildStepsFromStoredEvents } from "./foldStepEvents";

export async function loadFoldedBuildStepsForRun(
  db: SupabaseClient,
  runId: string
): Promise<BuildStep[]> {
  const { data, error } = await db
    .from("generation_events")
    .select("seq,step")
    .eq("run_id", runId)
    .order("seq", { ascending: true });

  if (error || !data?.length) {
    return [];
  }
  return foldBuildStepsFromStoredEvents(data as Array<{ seq: number; step: unknown }>);
}
