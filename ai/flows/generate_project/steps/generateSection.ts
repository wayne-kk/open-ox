import {
  formatSiteFile,
  hasCapabilityAssist,
  loadCapabilityAssist,
  loadGuardrail,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractContent } from "../shared/llm";
import type {
  CapabilitySpec,
  GuardrailId,
  PageDesignPlan,
  ProductScope,
  TaskLoop,
  UserRole,
  PlannedSectionSpec,
} from "../types";
import { buildDefaultSectionDesignPlan } from "../planners/defaultProjectPlanner";

export interface GenerateSectionParams {
  designSystem: string;
  projectGuardrailIds: GuardrailId[];
  projectContext: {
    projectTitle: string;
    projectDescription: string;
    productScope: ProductScope;
    roles: UserRole[];
    taskLoops: TaskLoop[];
    capabilities: CapabilitySpec[];
  };
  section: PlannedSectionSpec;
  outputFileRelative: string;
  pageContext?: {
    title: string;
    slug: string;
    description: string;
    journeyStage: string;
    primaryRoleIds: string[];
    supportingCapabilityIds: string[];
    pageDesignPlan: PageDesignPlan;
  };
}

export async function stepGenerateSection({
  designSystem,
  projectGuardrailIds,
  projectContext,
  section,
  outputFileRelative,
  pageContext,
}: GenerateSectionParams): Promise<string> {
  const designPlan =
    section.designPlan ??
    buildDefaultSectionDesignPlan(section, {
      roles: projectContext.roles,
      taskLoops: projectContext.taskLoops,
      capabilities: projectContext.capabilities,
      designKeywords: [],
    });
  const guardrailBlocks = Array.from(
    new Set([...projectGuardrailIds, ...designPlan.guardrailIds])
  )
    .map((guardrailId) => loadGuardrail(guardrailId))
    .join("\n\n");
  const capabilityBlocks = designPlan.capabilityAssistIds
    .filter((assistId) => hasCapabilityAssist(assistId))
    .map((assistId) => loadCapabilityAssist(assistId))
    .join("\n\n");
  const systemPrompt = [
    loadSystem("frontend"),
    guardrailBlocks,
    capabilityBlocks,
    loadGuardrail("outputTsx"),
  ]
    .filter(Boolean)
    .join("\n\n");
  const pageContextBlock = pageContext
    ? `## Page Context
- **Title**: ${pageContext.title}
- **Slug**: ${pageContext.slug}
- **Description**: ${pageContext.description}
- **Journey Stage**: ${pageContext.journeyStage}
- **Primary Roles**: ${pageContext.primaryRoleIds.join(", ") || "none"}
- **Supporting Capabilities**: ${pageContext.supportingCapabilityIds.join(", ") || "none"}

## Page Design Plan
- **Page Goal**: ${pageContext.pageDesignPlan.pageGoal}
- **Audience Focus**: ${pageContext.pageDesignPlan.audienceFocus}
- **Role Fit**: ${pageContext.pageDesignPlan.roleFit}
- **Capability Focus**: ${pageContext.pageDesignPlan.capabilityFocus}
- **Task Loop Coverage**: ${pageContext.pageDesignPlan.taskLoopCoverage}
- **Narrative Arc**: ${pageContext.pageDesignPlan.narrativeArc}
- **Layout Strategy**: ${pageContext.pageDesignPlan.layoutStrategy}
- **Hierarchy**: ${pageContext.pageDesignPlan.hierarchy.join(" | ")}
- **Transition Strategy**: ${pageContext.pageDesignPlan.transitionStrategy}
- **Shared Shell Notes**: ${pageContext.pageDesignPlan.sharedShellNotes.join(" | ")}
- **Page Constraints**:
${pageContext.pageDesignPlan.constraints.map((constraint) => `  - ${constraint}`).join("\n")}`
    : `## Page Context
This is a shared layout section. Design it to work coherently across the whole project.`;
  const rolesBlock = projectContext.roles
    .map(
      (role) =>
        `- ${role.roleName} (${role.roleId}): ${role.summary}\n  - Goals: ${role.goals.join(" | ")}\n  - Core Actions: ${role.coreActions.join(" | ")}`
    )
    .join("\n");
  const taskLoopsBlock = projectContext.taskLoops
    .map(
      (loop) =>
        `- ${loop.name} (${loop.loopId})\n  - Role: ${loop.roleId}\n  - Trigger: ${loop.entryTrigger}\n  - Steps: ${loop.steps.join(" -> ")}\n  - Success: ${loop.successState}`
    )
    .join("\n");
  const capabilitiesBlock = projectContext.capabilities
    .map(
      (capability) =>
        `- ${capability.name} (${capability.capabilityId})\n  - Summary: ${capability.summary}\n  - Roles: ${capability.primaryRoleIds.join(", ") || "none"}`
    )
    .join("\n");
  const userMessage = `## Design System
${designSystem}

## Project Context
- **Project**: ${projectContext.projectTitle}
- **Description**: ${projectContext.projectDescription}
- **Product Type**: ${projectContext.productScope.productType}
- **MVP Definition**: ${projectContext.productScope.mvpDefinition}
- **Core Outcome**: ${projectContext.productScope.coreOutcome}
- **Business Goal**: ${projectContext.productScope.businessGoal}
- **In Scope**: ${projectContext.productScope.inScope.join(" | ")}
- **Out Of Scope**: ${projectContext.productScope.outOfScope.join(" | ") || "none"}

## Roles
${rolesBlock}

## Task Loops
${taskLoopsBlock}

## Capabilities
${capabilitiesBlock || "- none"}

${pageContextBlock}

## Section to Generate
- **Type**: ${section.type}
- **Component Name**: ${section.fileName}
- **Intent**: ${section.intent}
- **Content Hints**: ${section.contentHints}
- **Primary Role IDs**: ${section.primaryRoleIds.join(", ") || "none"}
- **Supporting Capability IDs**: ${section.supportingCapabilityIds.join(", ") || "none"}
- **Source Task Loop IDs**: ${section.sourceTaskLoopIds.join(", ") || "none"}
- **Role**: ${designPlan.role}
- **Goal**: ${designPlan.goal}
- **Role Fit**: ${designPlan.roleFit}
- **Task Loop Focus**: ${designPlan.taskLoopFocus}
- **Capability Focus**: ${designPlan.capabilityFocus}
- **Information Architecture**: ${designPlan.informationArchitecture}
- **Layout Intent**: ${designPlan.layoutIntent}
- **Visual Intent**: ${designPlan.visualIntent}
- **Interaction Intent**: ${designPlan.interactionIntent}
- **Content Strategy**: ${designPlan.contentStrategy}
- **Hierarchy**: ${designPlan.hierarchy.join(" | ")}
- **Section Guardrail IDs**: ${designPlan.guardrailIds.join(", ")}
- **Capability Assist IDs**: ${designPlan.capabilityAssistIds.join(", ") || "none"}
- **Constraints**:
${designPlan.constraints.map((constraint) => `  - ${constraint}`).join("\n")}
- **Planner Rationale**: ${designPlan.rationale ?? "No rationale provided."}

Generate the complete ${section.fileName}.tsx component.
Treat the design plan as the primary source of truth. Capability assists are optional helpers, not mandatory templates.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.7);
  const tsx = extractContent(raw, "tsx");
  const filePath = outputFileRelative;

  await writeSiteFile(filePath, tsx);
  await formatSiteFile(filePath);

  return filePath;
}
