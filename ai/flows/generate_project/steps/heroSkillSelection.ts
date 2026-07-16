import { callLLM, extractJSON } from "../shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getSkillPromptsRoot, loadSkillPrompt } from "../shared/files";
import {
  discoverSkillsBySectionType,
  type SkillMetadata,
} from "../../../shared/skillDiscovery";
import { getModelForStep } from "@/lib/config/models";
import type { PlannedSectionSpec, ComponentSkillScore } from "../types";

export function buildSectionSearchableText(
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): string {
  return [rawUserInput ?? "", section.intent, section.contentHints, ...designKeywords]
    .join(" ")
    .toLowerCase();
}

function formatSkillCandidateListForLlm(candidates: SkillMetadata[]): string {
  return candidates
    .map((c) => {
      const w = c.when;
      const parts = [`id: "${c.id}"`];
      if (c.notes) parts.push(`description: ${c.notes}`);
      if (w?.designKeywords?.any?.length) {
        parts.push(`matches keywords: [${w.designKeywords.any.join(", ")}]`);
      }
      if (w?.designKeywords?.none?.length) {
        parts.push(`excludes keywords: [${w.designKeywords.none.join(", ")}]`);
      }
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function formatSkillMetadataLine(c: SkillMetadata): string {
  return `- **${c.id}** (priority: ${c.priority}): ${c.notes || "no description"}`;
}

export function scoreComponentCandidate(
  candidate: SkillMetadata,
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): ComponentSkillScore {
  const searchableText = buildSectionSearchableText(section, designKeywords, rawUserInput);

  const anyKeywords = candidate.when?.designKeywords?.any ?? [];
  const noneKeywords = candidate.when?.designKeywords?.none ?? [];
  const matchedKeywords = anyKeywords.filter((kw) => searchableText.includes(kw.toLowerCase()));
  const excludedKeywords = noneKeywords.filter((kw) => searchableText.includes(kw.toLowerCase()));

  const reasons: string[] = [];
  let score = 0;
  const priority = Math.max(0, candidate.priority ?? 0);

  if (anyKeywords.length > 0) {
    const coverage = matchedKeywords.length / anyKeywords.length;
    const coverageScore = Math.round(priority * 0.75 * coverage);
    score += coverageScore;
    reasons.push(`keyword coverage ${matchedKeywords.length}/${anyKeywords.length} (+${coverageScore})`);
  } else {
    const baseline = Math.round(priority * 0.35);
    score += baseline;
    reasons.push(`no positive keywords configured (+${baseline})`);
  }

  const sectionAffinity = Math.round(priority * 0.15);
  score += sectionAffinity;
  reasons.push(`section type affinity (${section.type}) (+${sectionAffinity})`);

  if (matchedKeywords.length > 0) {
    const confidenceBonus = Math.round(priority * 0.1);
    score += confidenceBonus;
    reasons.push(`explicit keyword hits: ${matchedKeywords.join(", ")} (+${confidenceBonus})`);
  }

  if (excludedKeywords.length > 0) {
    const penalty = Math.round(priority * 0.4);
    score -= penalty;
    reasons.push(`excluded keywords hit: ${excludedKeywords.join(", ")} (-${penalty})`);
  }

  const maxScore = Math.max(0, priority - 1);
  const boundedScore = Math.min(maxScore, Math.max(0, score));
  reasons.push(`bounded score ${boundedScore}/${priority}`);

  return {
    id: candidate.id,
    priority,
    score: boundedScore,
    reasons,
    matchedKeywords,
    excludedKeywords,
  };
}

async function llmSelectSkill(
  candidates: SkillMetadata[],
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<string | null> {
  if (candidates.length === 0) return null;

  const skillList = formatSkillCandidateListForLlm(candidates);

  const systemPrompt = `Select at most ONE component skill for this section.

Decision policy:
1. Evaluate all candidate skills holistically using user request, section intent, content hints, and design keywords.
2. Choose a skill only when there is clear evidence it is the best fit for this section.
3. If confidence is low or multiple skills are similarly plausible, return {"skillId": null}.
4. Do not infer or output any skill that is not in Candidate skills.
5. Prefer precision over novelty.

Return JSON only: {"skillId":"<id>"|null}`;

  const userMessage = `Original user request (HIGHEST PRIORITY): ${rawUserInput ?? "N/A"}

Section type: ${section.type}
Section intent: ${section.intent}
Section content hints: ${section.contentHints}
Design keywords: ${designKeywords.join(", ")}

Candidate skills:
${skillList}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0, 128, getModelForStep("preselect_skills"), {
      langfuseName: lfPlain(LfPlain.heroComponentSkillPick),
    });
    const parsed = JSON.parse(extractJSON(raw)) as { skillId?: string | null };
    const id = typeof parsed.skillId === "string" ? parsed.skillId.trim() : "";
    if (!id) return null;
    return candidates.some((c) => c.id === id) ? id : null;
  } catch (err) {
    console.warn(
      `[skill-select] llmSelectSkill failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * @deprecated Hero skill selection removed from generatePages / Page Agent (visual-signal-fixes).
 * Kept for ad-hoc tooling / tests only — do not wire back into the chrome-first pipeline.
 */
export async function discoverAndSelectSkill(
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<{
  componentSkillId: string | null;
  componentSkillPrompt: string;
  componentSkillMetadataBlock: string;
  componentSkillScores: ComponentSkillScore[];
}> {
  const sectionType = section.type.trim().toLowerCase();
  const root = getSkillPromptsRoot();
  const sectionCandidates = discoverSkillsBySectionType(root, sectionType);

  console.log(
    `[skill-select] sectionType="${sectionType}" root="${root}" sectionCandidates=${sectionCandidates.length}`
  );

  if (sectionCandidates.length === 0) {
    return {
      componentSkillId: null,
      componentSkillPrompt: "",
      componentSkillMetadataBlock: "",
      componentSkillScores: [],
    };
  }

  const componentCandidates = sectionCandidates.filter((c) => !c.kind || c.kind === "component-skill");

  const componentMetadataBlock = componentCandidates.map(formatSkillMetadataLine).join("\n");

  const componentSkillScores = componentCandidates
    .filter((c) => (c.priority ?? 0) > 60)
    .map((candidate) => scoreComponentCandidate(candidate, section, designKeywords, rawUserInput))
    .sort((a, b) => b.score - a.score);

  const llmChoice = await llmSelectSkill(componentCandidates, section, designKeywords, rawUserInput);

  if (llmChoice) {
    console.log(`[skill-select] llm component choice "${llmChoice}" for ${sectionType}`);
    return {
      componentSkillId: llmChoice,
      componentSkillPrompt: loadSkillPrompt(llmChoice),
      componentSkillMetadataBlock: componentMetadataBlock,
      componentSkillScores,
    };
  }

  console.log(`[skill-select] No component skill selected for ${sectionType}`);
  return {
    componentSkillId: null,
    componentSkillPrompt: "",
    componentSkillMetadataBlock: componentMetadataBlock,
    componentSkillScores,
  };
}
