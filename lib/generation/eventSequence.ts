import type { SupabaseClient } from "@supabase/supabase-js";

/** Return the last persisted sequence so a recovered run can append safely. */
export async function loadLastGenerationEventSequence(
  db: SupabaseClient,
  runId: string,
): Promise<number> {
  const { data, error } = await db
    .from("generation_events")
    .select("seq")
    .eq("run_id", runId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[generation] failed to load last event sequence: ${error.message}`,
    );
  }
  const seq = Number(data?.seq ?? 0);
  return Number.isSafeInteger(seq) && seq >= 0 ? seq : 0;
}

