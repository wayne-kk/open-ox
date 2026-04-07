import { buildDefaultProjectPlan, buildDefaultSectionDesignPlan } from "../planners/defaultProjectPlanner";
import {
  getAllowedProjectGuardrailIds,
  mergeProjectGuardrailIds,
} from "../planners/guardrailPolicy";
import { loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import { isStringArray } from "../shared/typeGuards";
import type {
  PageDesignPlan,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionSpec,
} from "../types";

function isPageDesignPlan(value: unknown): value is PageDesignPlan {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<PageDesignPlan>;
  return (
    typeof c.pageGoal === "string" &&
    typeof c.audienceFocus === "string" &&
    typeof c.roleFit === "string" &&
    typeof c.capabilityFocus === "string" &&
    typeof c.taskLoopCoverage === "string" &&
    typeof c.narrativeArc === "string" &&
    typeof c.layoutStrategy === "string" &&
    isStringArray(c.hierarchy) &&
    typeof c.transitionStrategy === "string" &&
    isStringArray(c.sharedShellNotes) &&
    isStringArray(c.constraints)
  );
}

function isSectionSpec(value: unknown): value is SectionSpec {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<SectionSpec>;
  return (
    typeof c.type === "string" &&
    typeof c.intent === "string" &&
    typeof c.fileName === "string"
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
${getAllowedProjectGuardrailIds().map((id) => `- ${id}`).join("\n")}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.2);
    const parsed = JSON.parse(extractJSON(raw)) as Record<string, unknown>;

    if (!isStringArray(parsed.projectGuardrailIds as unknown)) {
      return defaultPlan;
    }

    // Merge sections from LLM output into default plan
    const site = parsed.site as Record<string, unknown> | undefined;

    // Merge layout sections (just SectionSpec, no designPlan)
    const mergedLayoutSections = defaultPlan.site.layoutSections.map((defaultSection) => {
      const incoming = Array.isArray(site?.layoutSections)
        ? (site.layoutSections as unknown[]).find(
          (s) => s && typeof s === "object" && (s as { type?: string }).type === defaultSection.type
        ) as SectionSpec | undefined
        : undefined;
      if (incoming && isSectionSpec(incoming)) {
        return { ...defaultSection, intent: incoming.intent || defaultSection.intent, contentHints: incoming.contentHints || defaultSection.contentHints };
      }
      return defaultSection;
    });

    // Merge pages — accept new sections and pageDesignPlan from LLM
    const mergedPages = defaultPlan.site.pages.map((defaultPage) => {
      const incomingPage = Array.isArray(site?.pages)
        ? (site.pages as unknown[]).find(
          (p) => p && typeof p === "object" && (p as { slug?: string }).slug === defaultPage.slug
        ) as Record<string, unknown> | undefined
        : undefined;

      if (!incomingPage) return defaultPage;

      // Accept pageDesignPlan from LLM
      const pageDesignPlan = isPageDesignPlan(incomingPage.pageDesignPlan)
        ? incomingPage.pageDesignPlan
        : defaultPage.pageDesignPlan;

      // Accept sections from LLM (just SectionSpec — we generate designPlan from context)
      let sections = defaultPage.sections;
      if (Array.isArray(incomingPage.sections)) {
        const validSections = (incomingPage.sections as unknown[])
          .filter(isSectionSpec)
          .map((s) => ({
            type: s.type,
            intent: s.intent || "",
            contentHints: s.contentHints || "",
            fileName: s.fileName,
            primaryRoleIds: Array.isArray(s.primaryRoleIds) ? s.primaryRoleIds : [],
            supportingCapabilityIds: Array.isArray(s.supportingCapabilityIds) ? s.supportingCapabilityIds : [],
            sourceTaskLoopIds: Array.isArray(s.sourceTaskLoopIds) ? s.sourceTaskLoopIds : [],
          }));
        if (validSections.length > 0) {
          const planningContext = {
            roles: blueprint.brief.roles,
            taskLoops: blueprint.brief.taskLoops,
            capabilities: blueprint.brief.capabilities,
            designKeywords: blueprint.experience.designIntent.keywords,
          };
          sections = validSections.map((s) => ({
            ...s,
            designPlan: buildDefaultSectionDesignPlan(s, planningContext),
          }));
        }
      }

      return { ...defaultPage, pageDesignPlan, sections };
    });

    return {
      ...defaultPlan,
      projectGuardrailIds: mergeProjectGuardrailIds(
        parsed.projectGuardrailIds as string[],
        defaultPlan.projectGuardrailIds
      ),
      site: {
        ...defaultPlan.site,
        layoutSections: mergedLayoutSections,
        pages: mergedPages,
      },
    };
  } catch {
    return defaultPlan;
  }
}
