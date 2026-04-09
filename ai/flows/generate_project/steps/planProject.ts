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
  PlannedProjectBlueprint,
  ProjectBlueprint,
} from "../types";

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
        pages: defaultPlan.site.pages.map((page) => {
          const incomingPage = Array.isArray(parsed.site?.pages)
            ? parsed.site.pages.find(
              (candidate) =>
                candidate &&
                typeof candidate === "object" &&
                (candidate as { slug?: unknown }).slug === page.slug
            )
            : undefined;

          return {
            ...page,
            pageDesignPlan: mergePageDesignPlan(page.pageDesignPlan, incomingPage),
          };
        }),
      },
    };
  } catch {
    return defaultPlan;
  }
}
