import { buildDefaultProjectPlan } from "../planners/defaultProjectPlanner";
import {
  getAllowedProjectGuardrailIds,
  mergeProjectGuardrailIds,
} from "../planners/guardrailPolicy";
import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import { isStringArray } from "../shared/typeGuards";
import type {
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
} from "../types";
import { isLayoutSection } from "../registry/layoutSections";

function isPageDesignPlan(value: unknown): value is PageDesignPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PageDesignPlan>;
  return (
    typeof candidate.pageGoal === "string" &&
    typeof candidate.narrativeArc === "string" &&
    typeof candidate.layoutStrategy === "string" &&
    isStringArray(candidate.hierarchy) &&
    isStringArray(candidate.constraints)
  );
}

export async function stepPlanProject(
  blueprint: ProjectBlueprint
): Promise<PlannedProjectBlueprint> {
  const defaultPlan = buildDefaultProjectPlan(blueprint);
  const systemPrompt = composePromptBlocks([loadStepPrompt("planProject"), loadGuardrail("outputJson")]);
  const userMessage = `## Project: ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Minimal Product Scope
- Type: ${blueprint.brief.productScope.productType}
- MVP: ${blueprint.brief.productScope.mvpDefinition}
- Core Outcome: ${blueprint.brief.productScope.coreOutcome}
- Design Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}

## Pages to plan sections for
${blueprint.site.pages.map((page) =>
  `### ${page.title} (/${page.slug}) — ${page.journeyStage}
- Description: ${page.description}
- Roles: ${page.primaryRoleIds.join(", ") || "none"}
- Capabilities: ${page.supportingCapabilityIds.join(", ") || "none"}
- Existing sections: ${page.sections.length > 0 ? page.sections.map((s) => s.type).join(", ") : "NONE — derive from page description and capabilities"}`
).join("\n\n")}

## Layout Sections (shared shells)
${blueprint.site.layoutSections.map((s) => `- ${s.type}: ${s.intent}`).join("\n")}

## Allowed Project Guardrail IDs
${getAllowedProjectGuardrailIds().map((id) => `- ${id}`).join("\n")}

## Keep it simple
- Prefer the smallest section set that satisfies page goals.
- Avoid repeated sections with overlapping intent.
- Sections only need type, intent, contentHints, fileName, and role/capability/taskLoop IDs.
- Do not include designPlan on sections — guardrails and skills are resolved at generation time.`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.2);
    const parsed = JSON.parse(extractJSON(raw)) as Partial<PlannedProjectBlueprint>;

    if (!isStringArray(parsed.projectGuardrailIds)) {
      return defaultPlan;
    }

    const normalizeStringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

    const normalizePlannedSection = (
      value: unknown,
      fallback: PlannedSectionSpec,
      index: number
    ): PlannedSectionSpec => {
      const candidate = (value && typeof value === "object"
        ? value
        : {}) as Partial<PlannedSectionSpec>;
      const fallbackType = fallback.type || `section-${index + 1}`;
      return {
        type: typeof candidate.type === "string" && candidate.type.trim() ? candidate.type : fallbackType,
        intent:
          typeof candidate.intent === "string" && candidate.intent.trim()
            ? candidate.intent
            : fallback.intent,
        contentHints:
          typeof candidate.contentHints === "string" && candidate.contentHints.trim()
            ? candidate.contentHints
            : fallback.contentHints,
        fileName:
          typeof candidate.fileName === "string" && candidate.fileName.trim()
            ? candidate.fileName
            : fallback.fileName,
        primaryRoleIds:
          normalizeStringArray(candidate.primaryRoleIds).length > 0
            ? normalizeStringArray(candidate.primaryRoleIds)
            : fallback.primaryRoleIds,
        supportingCapabilityIds:
          normalizeStringArray(candidate.supportingCapabilityIds).length > 0
            ? normalizeStringArray(candidate.supportingCapabilityIds)
            : fallback.supportingCapabilityIds,
        sourceTaskLoopIds:
          normalizeStringArray(candidate.sourceTaskLoopIds).length > 0
            ? normalizeStringArray(candidate.sourceTaskLoopIds)
            : fallback.sourceTaskLoopIds,
      };
    };

    const mergeSections = (
      fallbackSections: PlannedSectionSpec[],
      incomingSections: unknown
    ): PlannedSectionSpec[] => {
      if (!Array.isArray(incomingSections) || incomingSections.length === 0) {
        return fallbackSections;
      }
      return incomingSections
        .map((section, index) =>
          normalizePlannedSection(section, fallbackSections[index] ?? fallbackSections[0], index)
        )
        .filter((section) => !isLayoutSection(section.type));
    };

    const mergeLayoutSections = (
      fallbackSections: PlannedSectionSpec[],
      incomingLayoutSections: unknown
    ): PlannedSectionSpec[] => {
      if (!Array.isArray(incomingLayoutSections) || incomingLayoutSections.length === 0) {
        return fallbackSections;
      }
      const merged = incomingLayoutSections
        .map((section, index) =>
          normalizePlannedSection(section, fallbackSections[index] ?? fallbackSections[0], index)
        )
        .filter((section) => isLayoutSection(section.type));
      return merged.length > 0 ? merged : fallbackSections;
    };

    const mergePageDesignPlan = (
      target: PageDesignPlan,
      incomingPage: unknown
    ): PageDesignPlan => {
      if (!incomingPage || typeof incomingPage !== "object") {
        return target;
      }

      const maybePlan = (incomingPage as { pageDesignPlan?: unknown }).pageDesignPlan;
      return isPageDesignPlan(maybePlan) ? maybePlan : target;
    };

    return {
      ...defaultPlan,
      projectGuardrailIds: mergeProjectGuardrailIds(
        parsed.projectGuardrailIds,
        defaultPlan.projectGuardrailIds
      ),
      site: {
        ...defaultPlan.site,
        layoutSections: mergeLayoutSections(defaultPlan.site.layoutSections, parsed.site?.layoutSections),
        pages: defaultPlan.site.pages.map((page) => {
          const incomingPage = Array.isArray(parsed.site?.pages)
            ? parsed.site.pages.find(
              (candidate) =>
                candidate &&
                typeof candidate === "object" &&
                (candidate as { slug?: unknown }).slug === page.slug
            )
            : undefined;

          const mergedSections = mergeSections(
            page.sections,
            (incomingPage as { sections?: unknown } | undefined)?.sections
          );

          return {
            ...page,
            pageDesignPlan: mergePageDesignPlan(page.pageDesignPlan, incomingPage),
            sections: mergedSections.length > 0 ? mergedSections : page.sections,
          };
        }),
      },
    };
  } catch {
    return defaultPlan;
  }
}
