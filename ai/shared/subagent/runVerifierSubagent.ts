import { executeRunScopedTscOnFiles } from "@/ai/tools/system/runScopedTscTool";
import { runSubagent } from "./runSubagent";
import type { SubagentResult } from "./types";

export type RunVerifierSubagentInput = {
  /** What the parent claims was completed. */
  claim: string;
  touchedFiles?: string[];
  extraContext?: string;
  model?: string;
  enableSubagents?: boolean;
};

/**
 * Orchestrator-facing verifier: report-only, never edits.
 * Hosts call this after modify final verification or repair.
 * Generate build-repair may re-invoke repair from the verdict (code-scheduled); Modify stays report-only.
 */
export async function runVerifierSubagent(
  input: RunVerifierSubagentInput
): Promise<SubagentResult | null> {
  if (input.enableSubagents === false) return null;

  const claim = input.claim?.trim() ?? "";
  if (!claim) {
    return {
      kind: "verifier",
      ok: false,
      summary: "",
      toolCallCount: 0,
      truncated: false,
      error: "Verifier claim must be a non-empty string.",
    };
  }

  const touched = (input.touchedFiles ?? []).map((p) =>
    p.replace(/\\/g, "/").replace(/^(\.\/)+/, "")
  );

  return runSubagent({
    kind: "verifier",
    task: claim,
    focusPaths: touched.length > 0 ? touched : undefined,
    extraContext: input.extraContext,
    model: input.model,
    executeToolOverrides: {
      run_scoped_tsc: async () => {
        if (touched.length === 0) {
          return {
            success: false,
            error:
              "No touched files available for scoped tsc. Use read_file/search_code to verify claims.",
          };
        }
        return executeRunScopedTscOnFiles(touched);
      },
    },
  });
}

export function formatVerifierReport(result: SubagentResult): string {
  if (!result.ok) {
    return `[verifier] error: ${result.error ?? "failed"}`;
  }
  return `[verifier]\n${result.summary}`;
}
