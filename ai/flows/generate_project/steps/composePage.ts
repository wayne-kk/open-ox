import {
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractContent } from "../shared/llm";
import {
  buildSectionImportPath,
  slugToPagePath,
} from "../shared/paths";
import type { PlannedPageBlueprint, PlannedSectionSpec } from "../types";

export async function stepComposePage(
  blueprint: PlannedPageBlueprint,
  designSystem: string,
  pageSections: PlannedSectionSpec[]
): Promise<string> {
  const systemPrompt = [
    loadSystem("frontend"),
    "\n\n",
    loadStepPrompt("composePage"),
    "\n\n",
    loadGuardrail("outputTsx"),
  ].join("");

  const importStatements = pageSections
    .map(
      (section) =>
        `import ${section.fileName} from "${buildSectionImportPath(blueprint.slug, section.fileName)}";`
    )
    .join("\n");

  const targetPagePath = slugToPagePath(blueprint.slug);
  const userMessage = `## Target Page Path
${targetPagePath}

## Page Title
${blueprint.title}

## Page Description
${blueprint.description}

## Product Mapping
- **Journey Stage**: ${blueprint.journeyStage}
- **Primary Roles**: ${blueprint.primaryRoleIds.join(", ") || "none"}
- **Supporting Capabilities**: ${blueprint.supportingCapabilityIds.join(", ") || "none"}

## Page Design Plan
- **Page Goal**: ${blueprint.pageDesignPlan.pageGoal}
- **Audience Focus**: ${blueprint.pageDesignPlan.audienceFocus}
- **Role Fit**: ${blueprint.pageDesignPlan.roleFit}
- **Capability Focus**: ${blueprint.pageDesignPlan.capabilityFocus}
- **Task Loop Coverage**: ${blueprint.pageDesignPlan.taskLoopCoverage}
- **Narrative Arc**: ${blueprint.pageDesignPlan.narrativeArc}
- **Layout Strategy**: ${blueprint.pageDesignPlan.layoutStrategy}
- **Hierarchy**: ${blueprint.pageDesignPlan.hierarchy.join(" | ")}
- **Transition Strategy**: ${blueprint.pageDesignPlan.transitionStrategy}
- **Shared Shell Notes**: ${blueprint.pageDesignPlan.sharedShellNotes.join(" | ")}
- **Page Constraints**:
${blueprint.pageDesignPlan.constraints.map((constraint) => `  - ${constraint}`).join("\n")}

## Import Statements
${importStatements}

## Content Sections to Compose (in order, navigation and footer are in layout.tsx — do NOT include them)
${pageSections.map((section, index) => `${index + 1}. ${section.fileName}`).join("\n")}

## Section Design Briefs
${pageSections
  .map(
    (section) => `### ${section.fileName}
- Type: ${section.type}
- Primary Roles: ${section.primaryRoleIds.join(", ") || "none"}
- Supporting Capabilities: ${section.supportingCapabilityIds.join(", ") || "none"}
- Source Task Loops: ${section.sourceTaskLoopIds.join(", ") || "none"}
- Role: ${section.designPlan.role}
- Goal: ${section.designPlan.goal}
- Role Fit: ${section.designPlan.roleFit}
- Task Loop Focus: ${section.designPlan.taskLoopFocus}
- Capability Focus: ${section.designPlan.capabilityFocus}
- Layout Intent: ${section.designPlan.layoutIntent}
- Visual Intent: ${section.designPlan.visualIntent}
- Interaction Intent: ${section.designPlan.interactionIntent}
- Capability Assists: ${section.designPlan.capabilityAssistIds.join(", ") || "none"}`
  )
  .join("\n\n")}

## Design System (for global effects)
${designSystem}

Generate the page component source for this page route.
Treat the page design plan as the composition strategy, not just a list of imports.`;

  const raw = await callLLM(systemPrompt, userMessage, 0.3);
  const tsx = extractContent(raw, "tsx");

  await writeSiteFile(targetPagePath, tsx);
  await formatSiteFile(targetPagePath);

  return targetPagePath;
}
