import { loadGuardrail, loadStepPrompt, loadSystem, writeSiteFile } from "../shared/files";
import { callLLM } from "../shared/llm";
import type { PlannedProjectBlueprint } from "../types";

export async function stepGenerateProjectDesignSystem(
  blueprint: PlannedProjectBlueprint
): Promise<string> {
  const projectGuardrails = blueprint.projectGuardrailIds
    .map((guardrailId) => loadGuardrail(guardrailId))
    .join("\n\n");
  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    projectGuardrails,
    "\n\n",
    loadStepPrompt("generateProjectDesignSystem"),
  ].join("");

  const pagesSummary = blueprint.site.pages
    .map(
      (page, index) =>
        `${index + 1}. ${page.title} (${page.slug})\n- ${page.description}\n- Sections: ${page.sections
          .map((section) => section.type)
          .join(", ")}\n- Journey Stage: ${page.journeyStage}\n- Roles: ${page.primaryRoleIds.join(", ") || "none"}\n- Capabilities: ${page.supportingCapabilityIds.join(", ") || "none"}\n- Page Goal: ${page.pageDesignPlan.pageGoal}\n- Narrative Arc: ${page.pageDesignPlan.narrativeArc}`
    )
    .join("\n");
  const rolesSummary = blueprint.brief.roles
    .map(
      (role) =>
        `- ${role.roleName} (${role.roleId})\n  - Summary: ${role.summary}\n  - Goals: ${role.goals.join(" | ")}`
    )
    .join("\n");
  const taskLoopSummary = blueprint.brief.taskLoops
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
  const pageMapSummary = blueprint.site.informationArchitecture.pageMap
    .map(
      (page) =>
        `- ${page.title} (${page.slug})\n  - Purpose: ${page.purpose}\n  - Roles: ${page.primaryRoleIds.join(", ") || "none"}\n  - Capabilities: ${page.supportingCapabilityIds.join(", ") || "none"}\n  - Journey Stage: ${page.journeyStage}`
    )
    .join("\n");

  const userMessage = `## Project: ${blueprint.brief.projectTitle}

## Product Scope
- Product Type: ${blueprint.brief.productScope.productType}
- MVP Definition: ${blueprint.brief.productScope.mvpDefinition}
- Core Outcome: ${blueprint.brief.productScope.coreOutcome}
- Business Goal: ${blueprint.brief.productScope.businessGoal}
- Audience Summary: ${blueprint.brief.productScope.audienceSummary}
- In Scope: ${blueprint.brief.productScope.inScope.join(" | ")}
- Out Of Scope: ${blueprint.brief.productScope.outOfScope.join(" | ") || "none"}

## Roles
${rolesSummary}

## Task Loops
${taskLoopSummary}

## Capabilities
${capabilitySummary || "- none"}

## Information Architecture
- Navigation Model: ${blueprint.site.informationArchitecture.navigationModel}
- Shared Shells: ${blueprint.site.informationArchitecture.sharedShells.join(" | ")}
- Notes: ${blueprint.site.informationArchitecture.notes.join(" | ") || "none"}

## Page Map
${pageMapSummary}

## Design Intent
- Mood: ${blueprint.experience.designIntent.mood.join(", ")}
- Color Direction: ${blueprint.experience.designIntent.colorDirection}
- Style: ${blueprint.experience.designIntent.style}
- Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}

## Project Description
${blueprint.brief.projectDescription}

## Project Guardrail IDs
${blueprint.projectGuardrailIds.join(", ")}

## Shared Layout Sections
${blueprint.site.layoutSections
  .map(
    (section) =>
      `- ${section.type}: ${section.intent}\n  - Product Roles: ${section.primaryRoleIds.join(", ") || "none"}\n  - Capabilities: ${section.supportingCapabilityIds.join(", ") || "none"}\n  - Role: ${section.designPlan.role}\n  - Visual Intent: ${section.designPlan.visualIntent}`
  )
  .join("\n")}

## Pages
${pagesSummary}

Generate the complete shared Design System for this website project.`;

  const designSystem = await callLLM(systemPrompt, userMessage, 0.8);
  await writeSiteFile("design-system.md", designSystem);
  return designSystem;
}
