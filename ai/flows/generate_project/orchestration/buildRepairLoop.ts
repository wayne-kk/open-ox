import type { BuildStep, GenerateProjectResult } from "../types";

export interface BuildRepairAttempt {
  attempt: number;
  buildPassed: boolean;
  output: string;
}

export function summarizeBuildRepair(attempts: BuildRepairAttempt[]): Pick<GenerateProjectResult, "verificationStatus"> & { buildSteps: BuildStep[] } {
  const passed = attempts.some((a) => a.buildPassed);
  const buildSteps: BuildStep[] = attempts.map((a) => ({
    name: a.attempt === 0 ? "run_build" : `run_build:retry_${a.attempt}`,
    status: a.buildPassed ? "done" : "error",
    output: a.output,
    durationMs: 0,
  }));
  return { verificationStatus: passed ? "passed" : "failed", buildSteps };
}
