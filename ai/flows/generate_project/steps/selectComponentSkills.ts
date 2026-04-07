/**
 * Component skill selector — metadata-only LLM + fallback
 *
 * 1. Discovery: 使用 ai/shared/skillDiscovery 扫描候选
 * 2. LLM: 仅传 metadata，不传 prompt 正文
 * 3. Fallback: LLM 返回 null 时取 fallback:true 且 priority 最高者
 */

import { callLLM, extractJSON } from "../shared/llm";
import { loadSkillPrompt } from "../shared/files";
import { getSkillPromptsRoot } from "../shared/files";
import {
  discoverSkillsBySectionType,
  toCompactMetadata,
  type SkillMetadata,
} from "../../../shared/skillDiscovery";
import type { PlannedSectionSpec, ProductScope } from "../types";

export interface ComponentSkillSelectionResult {
  id: string | null;
}

const SYSTEM_PROMPT = `You are a component skill selector for a UI code generator. Given a section to generate and a list of candidate skills (metadata only), pick the single best skill id, or null if none fit.

Rules:
- Match only when section context clearly aligns with skill's when.*.any fields.
- Prefer higher priority when multiple skills match.
- Return null if no skill is a good fit.
- Respond with JSON only: {"id": "component.hero.xxx"} or {"id": null}

Do not invent skill ids. Only return ids from the candidate list.`;

function buildUserMessage(params: {
  section: PlannedSectionSpec;
  productScope: ProductScope;
  designKeywords: string[];
  candidates: SkillMetadata[];
}): string {
  const { section, productScope, designKeywords, candidates } = params;

  const sectionContext = {
    type: section.type,
    intent: section.intent,
    contentHints: section.contentHints,
    traits: section.designPlan?.traits ?? {},
    designKeywords,
    productType: productScope.productType,
    journeyStage: productScope.journeyStageHints?.[0] ?? "",
  };

  const skillsJson = candidates.map((s) => toCompactMetadata(s));

  return [
    "## Section Context",
    JSON.stringify(sectionContext, null, 2),
    "",
    "## Candidate Skills (metadata only)",
    JSON.stringify(skillsJson, null, 2),
    "",
    "## Task",
    "Pick the single best skill id or null. Respond with JSON only:",
    '{"id": "component.hero.xxx"} or {"id": null}',
  ].join("\n");
}

function selectFallbackSkill(candidates: SkillMetadata[]): SkillMetadata | null {
  const fallbacks = candidates.filter((s) => s.fallback);
  if (fallbacks.length === 0) return null;
  return fallbacks[0];
}

export async function stepSelectComponentSkills(params: {
  section: PlannedSectionSpec;
  productScope: ProductScope;
  designKeywords: string[];
  skillsRootPath?: string;
}): Promise<ComponentSkillSelectionResult> {
  const { section, productScope, designKeywords, skillsRootPath } = params;
  const root = skillsRootPath ?? getSkillPromptsRoot();

  const candidates = discoverSkillsBySectionType(root, section.type);
  if (candidates.length === 0) {
    return { id: null };
  }

  const systemPrompt = SYSTEM_PROMPT;
  const userMessage = buildUserMessage({
    section,
    productScope,
    designKeywords,
    candidates,
  });

  const raw = await callLLM(systemPrompt, userMessage, 0.2);
  const json = extractJSON(raw);

  try {
    const parsed = JSON.parse(json) as { id?: string | null };
    const id = parsed?.id;
    const validIds = new Set(candidates.map((c) => c.id));

    if (typeof id === "string" && validIds.has(id)) {
      return { id };
    }
  } catch {
    return { id: null };
  }

  const fallback = selectFallbackSkill(candidates);
  return { id: fallback?.id ?? null };
}

/**
 * 根据选定 id 加载完整 prompt 正文（执行阶段使用）
 */
export function loadSelectedSkillPrompt(skillId: string | null): string {
  return skillId ? loadSkillPrompt(skillId) : "";
}
