import type { BuildStep, GenerateProjectResult } from "../types";

export interface BuildRepairAttempt {
  attempt: number;
  buildPassed: boolean;
  output: string;
}

export function summarizeBuildRepair(attempts: BuildRepairAttempt[]): Pick<GenerateProjectResult, "verificationStatus"> & { buildSteps: BuildStep[] } {
  const passed = attempts.some((a) => a.buildPassed);
  const buildSteps: BuildStep[] = attempts.map((a) => ({
    step: a.attempt === 0 ? "run_build" : `run_build:retry_${a.attempt}`,
    status: a.buildPassed ? "ok" : "error",
    detail: a.output,
    timestamp: Date.now(),
    duration: 0,
  }));
  return { verificationStatus: passed ? "passed" : "failed", buildSteps };
}
