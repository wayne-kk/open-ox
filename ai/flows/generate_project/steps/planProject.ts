import { buildDefaultProjectPlan } from "../planners/defaultProjectPlanner";
import { loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type {
  PageDesignPlan,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionDesignPlan,
} from "../types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSectionDesignPlan(value: unknown): value is SectionDesignPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SectionDesignPlan>;
  return (
    typeof candidate.role === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.roleFit === "string" &&
    typeof candidate.taskLoopFocus === "string" &&
    typeof candidate.capabilityFocus === "string" &&
    typeof candidate.informationArchitecture === "string" &&
    typeof candidate.layoutIntent === "string" &&
    typeof candidate.visualIntent === "string" &&
    typeof candidate.interactionIntent === "string" &&
    typeof candidate.contentStrategy === "string" &&
    isStringArray(candidate.hierarchy) &&
    isStringArray(candidate.guardrailIds) &&
    isStringArray(candidate.capabilityAssistIds) &&
    isStringArray(candidate.constraints) &&
    (candidate.shellPlacement == null ||
      candidate.shellPlacement === "beforePageContent" ||
      candidate.shellPlacement === "afterPageContent") &&
    (candidate.rationale == null || typeof candidate.rationale === "string")
  );
}

function isPageDesignPlan(value: unknown): value is PageDesignPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PageDesignPlan>;
  return (
    typeof candidate.pageGoal === "string" &&
    typeof candidate.audienceFocus === "string" &&
    typeof candidate.roleFit === "string" &&
    typeof candidate.capabilityFocus === "string" &&
    typeof candidate.taskLoopCoverage === "string" &&
    typeof candidate.narrativeArc === "string" &&
    typeof candidate.layoutStrategy === "string" &&
    isStringArray(candidate.hierarchy) &&
    typeof candidate.transitionStrategy === "string" &&
    isStringArray(candidate.sharedShellNotes) &&
    isStringArray(candidate.constraints) &&
    (candidate.rationale == null || typeof candidate.rationale === "string")
  );
}

export async function stepPlanProject(
  blueprint: ProjectBlueprint
): Promise<PlannedProjectBlueprint> {
  const defaultPlan = buildDefaultProjectPlan(blueprint);
  const systemPrompt = [loadStepPrompt("planProject"), "\n\n", loadGuardrail("outputJson")].join("");
  const rolesSummary = blueprint.brief.roles
    .map(
      (role) =>
        `- ${role.roleName} (${role.roleId})\n  - Summary: ${role.summary}\n  - Goals: ${role.goals.join(" | ")}\n  - Core Actions: ${role.coreActions.join(" | ")}`
    )
    .join("\n");
  const loopSummary = blueprint.brief.taskLoops
    .map(
      (loop) =>
        `- ${loop.name} (${loop.loopId})\n  - Role: ${loop.roleId}\n  - Trigger: ${loop.entryTrigger}\n  - Steps: ${loop.steps.join(" -> ")}\n  - Success: ${loop.successState}`
    )
    .join("\n");
  const capabilitySummary = blueprint.brief.capabilities
    .map(
      (capability) =>
        `- ${capability.name} (${capability.capabilityId})\n  - Summary: ${capability.summary}\n  - Roles: ${capability.primaryRoleIds.join(", ") || "none"}\n  - Priority: ${capability.priority}`
    )
    .join("\n");

  const userMessage = `## Project: ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Product Scope
- Type: ${blueprint.brief.productScope.productType}
- MVP: ${blueprint.brief.productScope.mvpDefinition}
- Outcome: ${blueprint.brief.productScope.coreOutcome}
- Audience: ${blueprint.brief.productScope.audienceSummary}
- In Scope: ${blueprint.brief.productScope.inScope.join(" | ")}

## Roles
${rolesSummary}

## Task Loops
${loopSummary}

## Capabilities
${capabilitySummary || "- none"}

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
- project.consistency
- project.accessibility

## Allowed Section Guardrail IDs
- section.core
- section.accessibility
- section.above-fold
- section.interactive

## Allowed Capability Assist IDs
- effect.motion.subtle
- effect.motion.ambient
- effect.motion.energetic
- pattern.hero.split
- pattern.hero.centered
- pattern.hero.editorial
- pattern.hero.dashboard
- pattern.features.grid
- pattern.pricing.three-tier
- pattern.faq.two-column`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.2);
    const parsed = JSON.parse(extractJSON(raw)) as Partial<PlannedProjectBlueprint>;

    if (!isStringArray(parsed.projectGuardrailIds)) {
      return defaultPlan;
    }

    const mergeSectionPlans = <
      T extends { fileName: string; designPlan: SectionDesignPlan }
    >(
      targetSections: T[],
      incomingSections: unknown
    ): T[] => {
      if (!Array.isArray(incomingSections)) {
        return targetSections;
      }

      const incomingMap = new Map<string, SectionDesignPlan>();
      for (const value of incomingSections) {
        if (!value || typeof value !== "object") {
          continue;
        }

        const fileName = (value as { fileName?: unknown }).fileName;
        const designPlan = (value as { designPlan?: unknown }).designPlan;
        if (typeof fileName === "string" && isSectionDesignPlan(designPlan)) {
          incomingMap.set(fileName, designPlan);
        }
      }

      return targetSections.map((section) => ({
        ...section,
        designPlan: incomingMap.get(section.fileName) ?? section.designPlan,
      }));
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
      projectGuardrailIds: parsed.projectGuardrailIds,
      site: {
        ...defaultPlan.site,
        layoutSections: mergeSectionPlans(
          defaultPlan.site.layoutSections,
          parsed.site?.layoutSections
        ),
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
            sections: mergeSectionPlans(page.sections, incomingPage?.sections),
          };
        }),
      },
    };
  } catch {
    return defaultPlan;
  }
}
