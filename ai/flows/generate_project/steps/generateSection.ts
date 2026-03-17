import {
  formatSiteFile,
  hasCapabilityAssist,
  loadCapabilityAssist,
  loadGuardrail,
  loadSectionPrompt,
  loadSkillPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { selectComponentSkillId } from "../selectors/componentSkillSelector";
import { selectSectionPromptId } from "../selectors/sectionPromptSelector";
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
  projectContext: GenerateSectionProjectContext;
  section: PlannedSectionSpec;
  outputFileRelative: string;
  pageContext?: GenerateSectionPageContext;
}

type GenerateSectionProjectContext = {
  projectTitle: string;
  projectDescription: string;
  productScope: ProductScope;
  roles: UserRole[];
  taskLoops: TaskLoop[];
  capabilities: CapabilitySpec[];
  pages: Array<{
    slug: string;
    title: string;
    description: string;
    journeyStage: string;
  }>;
};

type GenerateSectionPageContext = {
  title: string;
  slug: string;
  description: string;
  journeyStage: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  pageDesignPlan: PageDesignPlan;
};

function buildSectionDesignPlan(
  section: PlannedSectionSpec,
  projectContext: GenerateSectionProjectContext
) {
  return (
    section.designPlan ??
    buildDefaultSectionDesignPlan(section, {
      roles: projectContext.roles,
      taskLoops: projectContext.taskLoops,
      capabilities: projectContext.capabilities,
      designKeywords: [],
    })
  );
}

function buildGuardrailBlocks(projectGuardrailIds: GuardrailId[], designPlan: PlannedSectionSpec["designPlan"]) {
  return Array.from(new Set([...projectGuardrailIds, ...designPlan.guardrailIds]))
    .map((guardrailId) => loadGuardrail(guardrailId))
    .join("\n\n");
}

function buildCapabilityBlocks(designPlan: PlannedSectionSpec["designPlan"]) {
  return designPlan.capabilityAssistIds
    .filter((assistId) => hasCapabilityAssist(assistId))
    .map((assistId) => loadCapabilityAssist(assistId))
    .join("\n\n");
}

function buildSectionPromptBlocks(sectionType: string) {
  const sectionPromptId = selectSectionPromptId(sectionType);
  return [
    loadSectionPrompt("section.default"),
    sectionPromptId !== "section.default" ? loadSectionPrompt(sectionPromptId) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildComponentSkillBlock(
  section: PlannedSectionSpec,
  productScope: ProductScope
): string {
  const skillId = selectComponentSkillId({ section, productScope });
  return skillId ? loadSkillPrompt(skillId) : "";
}

function buildSystemPrompt(params: {
  section: PlannedSectionSpec;
  projectGuardrailIds: GuardrailId[];
  designPlan: PlannedSectionSpec["designPlan"];
  productScope: ProductScope;
}) {
  const { section, projectGuardrailIds, designPlan, productScope } = params;
  const componentSkillBlock = buildComponentSkillBlock(section, productScope);

  return [
    loadSystem("frontend"),
    buildSectionPromptBlocks(section.type),
    componentSkillBlock,
    buildGuardrailBlocks(projectGuardrailIds, designPlan),
    buildCapabilityBlocks(designPlan),
    loadGuardrail("outputTsx"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatRolesBlock(roles: UserRole[]) {
  return roles
    .map(
      (role) =>
        `- ${role.roleName} (${role.roleId}): ${role.summary}\n  - Goals: ${role.goals.join(" | ")}\n  - Core Actions: ${role.coreActions.join(" | ")}`
    )
    .join("\n");
}

function formatTaskLoopsBlock(taskLoops: TaskLoop[]) {
  return taskLoops
    .map(
      (loop) =>
        `- ${loop.name} (${loop.loopId})\n  - Role: ${loop.roleId}\n  - Trigger: ${loop.entryTrigger}\n  - Steps: ${loop.steps.join(" -> ")}\n  - Success: ${loop.successState}`
    )
    .join("\n");
}

function formatCapabilitiesBlock(capabilities: CapabilitySpec[]) {
  return capabilities
    .map(
      (capability) =>
        `- ${capability.name} (${capability.capabilityId})\n  - Summary: ${capability.summary}\n  - Roles: ${capability.primaryRoleIds.join(", ") || "none"}`
    )
    .join("\n");
}

function formatBulletList(items: string[]) {
  return items.map((item) => `  - ${item}`).join("\n");
}

function filterRelevantRoles(
  section: PlannedSectionSpec,
  projectContext: GenerateSectionProjectContext,
  pageContext?: GenerateSectionPageContext
) {
  const roleIds = new Set([
    ...section.primaryRoleIds,
    ...(pageContext?.primaryRoleIds ?? []),
  ]);

  return projectContext.roles.filter((role) => roleIds.has(role.roleId));
}

function filterRelevantTaskLoops(
  section: PlannedSectionSpec,
  projectContext: GenerateSectionProjectContext
) {
  const loopIds = new Set(section.sourceTaskLoopIds);
  return projectContext.taskLoops.filter((loop) => loopIds.has(loop.loopId));
}

function filterRelevantCapabilities(
  section: PlannedSectionSpec,
  projectContext: GenerateSectionProjectContext,
  pageContext?: GenerateSectionPageContext
) {
  const capabilityIds = new Set([
    ...section.supportingCapabilityIds,
    ...(pageContext?.supportingCapabilityIds ?? []),
  ]);

  return projectContext.capabilities.filter((capability) =>
    capabilityIds.has(capability.capabilityId)
  );
}

function extractMarkdownSection(markdown: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `${escapedHeading}\\n([\\s\\S]*?)(?=\\n##\\s|\\n#\\s|$)`,
    "i"
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}

function buildDesignSystemSummary(designSystem: string) {
  const sections = [
    { label: "Typography", heading: "## 2. Design Token System (The DNA)" },
    { label: "Component Stylings", heading: "## 3. Component Stylings" },
    { label: "Layout Strategy", heading: "## 4. Layout Strategy" },
    { label: "Effects & Animation", heading: "## 6. Effects & Animation" },
    { label: "Implementation Notes", heading: "## 10. Implementation Notes" },
  ]
    .map(({ label, heading }) => {
      const content = extractMarkdownSection(designSystem, heading);
      if (!content) {
        return "";
      }

      return `### ${label}\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return sections || designSystem.slice(0, 2000);
}

function formatKnownRoutesBlock(
  pages: GenerateSectionProjectContext["pages"]
) {
  return pages
    .map((page) => {
      const path = page.slug === "home" ? "/" : `/${page.slug}`;
      return `- ${page.title} (${page.slug}): ${path} — ${page.description} [${page.journeyStage}]`;
    })
    .join("\n");
}

function buildPageContextBlock(pageContext?: GenerateSectionPageContext) {
  if (!pageContext) {
    return `## Page Context
This is a shared layout section. Design it to work coherently across the whole project.`;
  }

  return `## Page Context
- **Title**: ${pageContext.title}
- **Slug**: ${pageContext.slug}
- **Route**: ${pageContext.slug === "home" ? "/" : `/${pageContext.slug}`}
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
${formatBulletList(pageContext.pageDesignPlan.constraints)}`;
}

function buildUserMessage(params: {
  designSystem: string;
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  designPlan: PlannedSectionSpec["designPlan"];
}) {
  const { designSystem, projectContext, pageContext, section, designPlan } = params;
  const relevantRoles = filterRelevantRoles(section, projectContext, pageContext);
  const relevantTaskLoops = filterRelevantTaskLoops(section, projectContext);
  const relevantCapabilities = filterRelevantCapabilities(section, projectContext, pageContext);
  const rolesBlock = formatRolesBlock(relevantRoles);
  const taskLoopsBlock = formatTaskLoopsBlock(relevantTaskLoops);
  const capabilitiesBlock = formatCapabilitiesBlock(relevantCapabilities);
  const knownRoutesBlock = formatKnownRoutesBlock(projectContext.pages);
  const pageContextBlock = buildPageContextBlock(pageContext);
  const designSystemSummary = buildDesignSystemSummary(designSystem);

  return `## Design System Summary
${designSystemSummary}

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
${rolesBlock || "- none"}

## Task Loops
${taskLoopsBlock || "- none"}

## Capabilities
${capabilitiesBlock || "- none"}

## Known Routes
${knownRoutesBlock || "- / (home)"}

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
${formatBulletList(designPlan.constraints)}
- **Planner Rationale**: ${designPlan.rationale ?? "No rationale provided."}

Generate the complete ${section.fileName}.tsx component.
Treat the design plan as the primary source of truth. Capability assists are optional helpers, not mandatory templates.`;
}

export async function stepGenerateSection({
  designSystem,
  projectGuardrailIds,
  projectContext,
  section,
  outputFileRelative,
  pageContext,
}: GenerateSectionParams): Promise<string> {
  const designPlan = buildSectionDesignPlan(section, projectContext);
  const systemPrompt = buildSystemPrompt({
    section,
    projectGuardrailIds,
    designPlan,
    productScope: projectContext.productScope,
  });
  const userMessage = buildUserMessage({
    designSystem,
    projectContext,
    pageContext,
    section,
    designPlan,
  });

  const raw = await callLLM(systemPrompt, userMessage, 0.7);
  const tsx = extractContent(raw, "tsx");
  const filePath = outputFileRelative;

  await writeSiteFile(filePath, tsx);
  await formatSiteFile(filePath);

  return filePath;
}
