import type { BuildStep } from "@/ai/flows";

export function foldBuildStepsFromStoredEvents(
  events: ReadonlyArray<{ seq: number; step: unknown }>
): BuildStep[] {
  const ordered = [...events].sort((a, b) => Number(a.seq) - Number(b.seq));
  let out: BuildStep[] = [];
  for (const row of ordered) {
    const step = row.step as BuildStep;
    const idx = out.findIndex((s) => s.step === step.step);
    out =
      idx >= 0 ? [...out.slice(0, idx), step, ...out.slice(idx + 1)] : [...out, step];
  }
  return out;
}
