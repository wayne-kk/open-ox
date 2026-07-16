import { listReferenceSiteCandidateUrls } from "@/lib/reference/referenceSiteUrls";
import { executeFetchReferencePage } from "@/ai/tools/system/fetchReferencePageTool";
import { executeReferenceSiteDigest } from "@/ai/tools/system/referenceSiteDigestTool";
import { executeWebSearch } from "@/ai/tools/system/webSearchTool";
import { runSubagent } from "./runSubagent";
import type { SubagentResult } from "./types";

export type RunResearchSubagentInput = {
  /** User brief / merged generate prompt. */
  userBrief: string;
  /** Optional explicit URLs; otherwise extracted from userBrief. */
  candidateUrls?: string[];
  model?: string;
  enableSubagents?: boolean;
};

/**
 * Orchestrator-facing research: digests reference sites, returns summary only.
 * Skip when disabled or when no marketing-site URL candidates exist.
 */
export async function runResearchSubagent(
  input: RunResearchSubagentInput
): Promise<SubagentResult | null> {
  if (input.enableSubagents === false) return null;

  const brief = input.userBrief?.trim() ?? "";
  if (!brief) {
    return {
      kind: "research",
      ok: false,
      summary: "",
      toolCallCount: 0,
      truncated: false,
      error: "Research brief must be a non-empty string.",
    };
  }

  const urls = (
    input.candidateUrls?.length
      ? input.candidateUrls
      : listReferenceSiteCandidateUrls(brief)
  )
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (urls.length === 0) return null;

  const task = [
    "Research the reference site(s) below for a website-generation intake brief.",
    "Digest each URL, then return the structured Markdown brief required by your system prompt.",
    "",
    `Candidate URLs:\n${urls.map((u) => `- ${u}`).join("\n")}`,
    "",
    "User request (for context only; do not invent features beyond evidence + this text):",
    brief.slice(0, 6000),
  ].join("\n");

  return runSubagent({
    kind: "research",
    task,
    extraContext: `Focus on these URLs first: ${urls.join(", ")}`,
    model: input.model,
    executeToolOverrides: {
      reference_site_digest: executeReferenceSiteDigest,
      fetch_reference_page: executeFetchReferencePage,
      web_search: executeWebSearch,
    },
  });
}

export function formatResearchBriefForParent(result: SubagentResult): string {
  if (!result.ok) {
    return `[research] error: ${result.error ?? "failed"}`;
  }
  return result.summary.trim();
}
