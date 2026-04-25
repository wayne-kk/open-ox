import { callLLM, extractJSON } from "../../shared/llm";
import { getSkillPromptsRoot, loadSkillPrompt } from "../../shared/files";
import {
  discoverSkillsBySectionType,
  discoverTechnicalSpecSkills,
  type SkillMetadata,
} from "../../../../shared/skillDiscovery";
import { getModelForStep } from "@/lib/config/models";
import type { PlannedSectionSpec } from "../../types";
import type { ComponentSkillScore } from "./types";

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
    const raw = await callLLM(systemPrompt, userMessage, 0, 128, getModelForStep("preselect_skills"));
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

async function llmSelectTechnicalSkills(
  candidates: SkillMetadata[],
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
  selectedComponentSkillId?: string | null,
): Promise<string[]> {
  if (candidates.length === 0) return [];

  const searchableText = buildSectionSearchableText(section, designKeywords, rawUserInput);

  // Hard gate for 3D/WebGL technical stack to avoid accidental matches on generic "animation" requests.
  const hasExplicit3DSignal = /(three(\.js|\s*js)?|webgl|shader|3d|三维|着色器)/i.test(
    searchableText,
  );
  if (!hasExplicit3DSignal) return [];

  const skillList = formatSkillCandidateListForLlm(candidates);

  const systemPrompt = `Select technical guidance skills that can be layered ON TOP OF component skills.

Rules:
1. Technical skills are complementary implementation guidance; they can co-exist with a component skill.
2. Select only skills that are strongly justified by user intent or section visual intent.
3. If no technical skill is clearly needed, return {"skillIds": []}.
4. Prefer precision and keep selection minimal (0-2 skills).
5. Do NOT select three-animation unless there are explicit 3D/WebGL/Three.js/shader signals.

Return JSON only: {"skillIds":["<id>", "..."]}`;

  const userMessage = `Original user request (highest priority): ${rawUserInput ?? "N/A"}

Section type: ${section.type}
Section intent: ${section.intent}
Section content hints: ${section.contentHints}
Design keywords: ${designKeywords.join(", ")}
Selected component skill: ${selectedComponentSkillId ?? "none"}

Candidate technical skills:
${skillList}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0, 256, getModelForStep("preselect_skills"));
    const parsed = JSON.parse(extractJSON(raw)) as { skillIds?: unknown };
    const skillIds = Array.isArray(parsed.skillIds) ? parsed.skillIds : [];
    const candidateIds = new Set(candidates.map((c) => c.id));
    return skillIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && candidateIds.has(id));
  } catch (err) {
    console.warn(
      `[skill-select] llmSelectTechnicalSkills failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}

export async function discoverAndSelectSkill(
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<{
  componentSkillId: string | null;
  componentSkillPrompt: string;
  componentSkillMetadataBlock: string;
  technicalSkillIds: string[];
  technicalSkillPrompts: string[];
  technicalSkillMetadataBlock: string;
  componentSkillScores: ComponentSkillScore[];
}> {
  const sectionType = section.type.trim().toLowerCase();
  const root = getSkillPromptsRoot();
  const sectionCandidates = discoverSkillsBySectionType(root, sectionType);
  const technicalCandidates = discoverTechnicalSpecSkills(root);

  console.log(
    `[skill-select] sectionType="${sectionType}" root="${root}" sectionCandidates=${sectionCandidates.length} technicalCandidates=${technicalCandidates.length}`
  );

  if (sectionCandidates.length === 0 && technicalCandidates.length === 0) {
    return {
      componentSkillId: null,
      componentSkillPrompt: "",
      componentSkillMetadataBlock: "",
      technicalSkillIds: [],
      technicalSkillPrompts: [],
      technicalSkillMetadataBlock: "",
      componentSkillScores: [],
    };
  }

  const componentCandidates = sectionCandidates.filter((c) => !c.kind || c.kind === "component-skill");

  const componentMetadataBlock = componentCandidates.map(formatSkillMetadataLine).join("\n");

  const componentSkillScores = componentCandidates
    .filter((c) => (c.priority ?? 0) > 60)
    .map((candidate) => scoreComponentCandidate(candidate, section, designKeywords, rawUserInput))
    .sort((a, b) => b.score - a.score);

  const technicalMetadataBlock = technicalCandidates.map(formatSkillMetadataLine).join("\n");

  const llmChoice = await llmSelectSkill(componentCandidates, section, designKeywords, rawUserInput);
  const technicalChoices = await llmSelectTechnicalSkills(
    technicalCandidates,
    section,
    designKeywords,
    rawUserInput,
    llmChoice,
  );

  const technicalSkillPrompts = technicalChoices.map((id) => loadSkillPrompt(id));

  if (llmChoice) {
    console.log(`[skill-select] llm component choice "${llmChoice}" for ${sectionType}`);
    if (technicalChoices.length > 0) {
      console.log(`[skill-select] llm technical choices [${technicalChoices.join(",")}] for ${sectionType}`);
    }
    return {
      componentSkillId: llmChoice,
      componentSkillPrompt: loadSkillPrompt(llmChoice),
      componentSkillMetadataBlock: componentMetadataBlock,
      technicalSkillIds: technicalChoices,
      technicalSkillPrompts,
      technicalSkillMetadataBlock: technicalMetadataBlock,
      componentSkillScores,
    };
  }

  if (technicalChoices.length > 0) {
    console.log(`[skill-select] no component skill; technical choices [${technicalChoices.join(",")}] for ${sectionType}`);
  } else {
    console.log(`[skill-select] No component/technical skill selected for ${sectionType}`);
  }
  return {
    componentSkillId: null,
    componentSkillPrompt: "",
    componentSkillMetadataBlock: componentMetadataBlock,
    technicalSkillIds: technicalChoices,
    technicalSkillPrompts,
    technicalSkillMetadataBlock: technicalMetadataBlock,
    componentSkillScores,
  };
}
