import {
  buildRepairRefeedBuildOutput,
  shouldRefeedRepairFromVerifier,
  type VerifierVerdict,
} from "@/ai/shared/subagent";
import type { BuildRepairResult, RepairVerifierVerdict } from "../types";

export function repairVerifierNeedsRefeed(
  result: Pick<BuildRepairResult, "success" | "verifierVerdict" | "verifierReport">
): boolean {
  if (!result.success) return false;
  if (!result.verifierReport?.trim()) return false;
  return shouldRefeedRepairFromVerifier(
    result.verifierVerdict as VerifierVerdict | undefined
  );
}

export function buildVerifierRefeedBuildOutput(params: {
  originalBuildOutput: string;
  repairResult: Pick<BuildRepairResult, "verifierReport" | "output">;
}): string {
  const report =
    params.repairResult.verifierReport?.trim() ||
    params.repairResult.output.trim();
  return buildRepairRefeedBuildOutput({
    originalBuildOutput: params.originalBuildOutput,
    verifierReport: report,
  });
}

export function mergeRepairTouchedFiles(
  first: BuildRepairResult,
  refeed: BuildRepairResult
): string[] {
  return Array.from(new Set([...first.touchedFiles, ...refeed.touchedFiles]));
}

export function describeVerifierVerdict(
  verdict: RepairVerifierVerdict | undefined
): string {
  return verdict ?? "skipped";
}
