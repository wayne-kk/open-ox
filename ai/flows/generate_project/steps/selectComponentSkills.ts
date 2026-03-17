import { loadSkillPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type { PlannedSectionSpec, ProductScope } from "../types";
import { COMPONENT_SKILL_IDS } from "../selectors/componentSkillSelector";

export interface ComponentSkillMetadata {
  id: string;
  kind?: string;
  sectionTypes?: string[];
  priority?: number;
  fallback?: boolean;
  when?: Record<string, unknown>;
  notes?: string;
}

export interface ComponentSkillSelection {
  id: string;
  reason: string;
  confidence: number;
}

export interface ComponentSkillSelectionResult {
  selected: ComponentSkillSelection[];
}

function buildSystemPrompt(): string {
  return [
    "You are a component skill selector for a UI code generator.",
    "You receive:",
    "- The current section context (type, intent, content hints, assists, etc.).",
    "- High-level project context (product type, journey stage, design keywords).",
    "- A list of candidate component skills with their frontmatter-style metadata.",
    "",
    "Your job is to decide which, if any, skills should be applied.",
    "",
    "Rules:",
    "- Prefer skills whose metadata clearly matches the section and context.",
    "- If multiple skills match, you may return more than one, ordered by usefulness.",
    "- If no skill is clearly appropriate, return an empty list.",
    "- Do not invent new skill IDs.",
    "- Respond with a single JSON object only.",
  ].join("\n");
}

function buildUserMessage(params: {
  section: PlannedSectionSpec;
  productScope: ProductScope;
  designKeywords: string[];
  skills: { id: string; prompt: string }[];
}): string {
  const { section, productScope, designKeywords, skills } = params;

  const skillsBlock = skills
    .map(
      (skill) =>
        `### Skill: ${skill.id}\n` +
        "```md\n" +
        skill.prompt.split("\n").slice(0, 80).join("\n") +
        "\n```"
    )
    .join("\n\n");

  return [
    "## Section Context",
    JSON.stringify(
      {
        type: section.type,
        intent: section.intent,
        contentHints: section.contentHints,
        capabilityAssistIds: section.designPlan?.capabilityAssistIds ?? [],
        guardrailIds: section.designPlan?.guardrailIds ?? [],
      },
      null,
      2
    ),
    "",
    "## Project Context",
    JSON.stringify(
      {
        productType: productScope.productType,
        journeyStageHints: productScope.journeyStageHints ?? [],
        designKeywords,
      },
      null,
      2
    ),
    "",
    "## Candidate Skills (metadata + prompt excerpt)",
    skillsBlock || "(none)",
    "",
    "## Task",
    "From the candidate skills, choose zero or more that best fit the section and project context.",
    "Respond with JSON only in the following shape:",
    "",
    "```json",
    '{ "selected": [ { "id": "component.hero.impactful", "reason": "why", "confidence": 0.9 } ] }',
    "```",
  ].join("\n");
}

export async function stepSelectComponentSkills(params: {
  section: PlannedSectionSpec;
  productScope: ProductScope;
  designKeywords: string[];
}): Promise<ComponentSkillSelectionResult> {
  const { section, productScope, designKeywords } = params;
  const candidateIds = COMPONENT_SKILL_IDS[section.type] ?? [];

  if (candidateIds.length === 0) {
    return { selected: [] };
  }

  const skills = candidateIds.map((id) => ({
    id,
    prompt: loadSkillPrompt(id),
  }));

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage({
    section,
    productScope,
    designKeywords,
    skills,
  });

  const raw = await callLLM(systemPrompt, userMessage, 0.2);
  const json = extractJSON(raw);

  try {
    const parsed = JSON.parse(json) as ComponentSkillSelectionResult;
    if (!parsed || !Array.isArray(parsed.selected)) {
      return { selected: [] };
    }

    return {
      selected: parsed.selected
        .filter(
          (item) =>
            typeof item?.id === "string" &&
            typeof item?.reason === "string" &&
            typeof item?.confidence === "number"
        )
        .sort((a, b) => b.confidence - a.confidence),
    };
  } catch {
    return { selected: [] };
  }
}

