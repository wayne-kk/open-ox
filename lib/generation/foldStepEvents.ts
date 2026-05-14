import type { BuildStep } from "@/ai/flows";

/**
 * Latest wins per `step.step`, order = first-seen step names — O(n), same semantics as iterative upsert.
 */
export function foldBuildStepsFromStoredEvents(
  events: ReadonlyArray<{ seq: number; step: unknown }>
): BuildStep[] {
  const ordered = [...events].sort((a, b) => Number(a.seq) - Number(b.seq));
  const order: string[] = [];
  const latest = new Map<string, BuildStep>();
  for (const row of ordered) {
    const step = row.step as BuildStep;
    const key = step.step;
    if (!latest.has(key)) order.push(key);
    latest.set(key, step);
  }
  return order.map((k) => latest.get(k)!);
}

/** One step of the fold — used by the generation worker for live `projects.build_steps` materialization. */
export function upsertBuildStepByName(steps: BuildStep[], next: BuildStep): BuildStep[] {
  const idx = steps.findIndex((s) => s.step === next.step);
  return idx >= 0 ? [...steps.slice(0, idx), next, ...steps.slice(idx + 1)] : [...steps, next];
}
