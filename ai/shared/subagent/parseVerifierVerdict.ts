export type VerifierVerdict = "pass" | "fail" | "partial" | "unknown";

/**
 * Parse VERDICT line from verifier subagent summary.
 * Tolerates minor formatting drift; unknown when missing/unparseable.
 */
export function parseVerifierVerdict(summary: string): VerifierVerdict {
  const text = summary?.trim() ?? "";
  if (!text) return "unknown";

  const lineMatch = text.match(/^\s*VERDICT:\s*(pass|fail|partial)\b/im);
  if (lineMatch?.[1]) {
    return lineMatch[1].toLowerCase() as VerifierVerdict;
  }

  // Fallback: first explicit token after VERDICT anywhere in the summary.
  const loose = text.match(/\bVERDICT\b\s*[:\-–]?\s*(pass|fail|partial)\b/i);
  if (loose?.[1]) {
    return loose[1].toLowerCase() as VerifierVerdict;
  }

  return "unknown";
}

/** Orchestrator may re-run repair when verifier is skeptical (fail/partial). */
export function shouldRefeedRepairFromVerifier(
  verdict: VerifierVerdict | undefined | null
): boolean {
  return verdict === "fail" || verdict === "partial";
}

export function buildRepairRefeedBuildOutput(params: {
  originalBuildOutput: string;
  verifierReport: string;
}): string {
  const build = params.originalBuildOutput.trim();
  const report = params.verifierReport.trim();
  return [
    build,
    "",
    "## Verifier findings (prior repair claimed success; address these before finishing)",
    report || "(empty verifier report)",
  ].join("\n");
}
