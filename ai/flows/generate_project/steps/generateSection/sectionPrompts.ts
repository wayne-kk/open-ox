import {
  composePromptBlocks,
  loadGuardrail,
  loadSectionPrompt,
  loadSystem,
} from "../../shared/files";
import { selectSectionPromptId } from "../../selectors/sectionPromptSelector";
import type { LayoutMode, PlannedSectionSpec } from "../../types";
import type { GenerateSectionPageContext, GenerateSectionProjectContext } from "./types";

const WHOLE_PAGE_MODE_COPY = {
  withDescribeBrief: {
    implementationSource: "described in the brief",
    priorityRule:
      "If **Section Design Brief** or product intent conflict with generic marketing rules in older instructions, this whole-page spec wins.",
  },
  withComponentSkill: {
    implementationSource:
      "from section intent, content hints, and product context (page-level section brief is omitted because a component skill is in use)",
    priorityRule:
      "If product intent conflicts with generic marketing rules in older instructions, this whole-page spec wins.",
  },
} as const;

export function buildWholePageModeBlock(
  layoutMode: LayoutMode | undefined,
  useDescribePageBrief: boolean,
): string {
  if (layoutMode !== "whole-page") {
    return "";
  }
  const { implementationSource, priorityRule } = useDescribePageBrief
    ? WHOLE_PAGE_MODE_COPY.withDescribeBrief
    : WHOLE_PAGE_MODE_COPY.withComponentSkill;

  return `## Generation mode: whole-page (single-surface product)
- This file is the **entire product surface** for the route — not one marketing block among many. Implement the full shell / game / tool / app ${implementationSource}.
- ${priorityRule}

`;
}

function buildSectionPromptBlocks(sectionType: string, layoutMode?: LayoutMode) {
  const sectionPromptId = selectSectionPromptId(sectionType);
  const basePromptId = layoutMode === "whole-page" ? "section.wholePage" : "section.default";
  return [loadSectionPrompt(basePromptId), sectionPromptId !== "section.default" ? loadSectionPrompt(sectionPromptId) : ""]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * `composePromptBlocks` with explicit `loadGuardrail` calls (no runtime guardrail id discovery).
 */
export function buildSystemPrompt(params: {
  section: PlannedSectionSpec;
  skillPrompts: string[];
  designSystem: string;
  layoutMode?: LayoutMode;
}): string {
  const { section, skillPrompts, designSystem, layoutMode } = params;
  const selectedSkillPromptBlock = skillPrompts.filter(Boolean).join("\n\n");

  return composePromptBlocks([
    loadSystem("frontend"),
    loadGuardrail("project.accessibility"),
    `## Design System\n${designSystem}`,
    loadGuardrail("tailwindMappingGuide"),
    buildSectionPromptBlocks(section.type, layoutMode),
    loadGuardrail("skillIntegrationContract"),
    selectedSkillPromptBlock,
    loadGuardrail("framerMotionVariants"),
    loadGuardrail("outputTsx"),
  ]);
}

function formatKnownRoutesBlock(pages: GenerateSectionProjectContext["pages"]) {
  return pages
    .map((p) => `- ${p.title}: ${p.slug === "home" ? "/" : `/${p.slug}`}`)
    .join("\n");
}

function buildPageContextBlock(pageContext?: GenerateSectionPageContext) {
  if (!pageContext) {
    return `## Page Context\nThis is a shared layout section. Design it to work coherently across the whole project.`;
  }
  return `## Page Context
- **Title**: ${pageContext.title}
- **Route**: ${pageContext.slug === "home" ? "/" : `/${pageContext.slug}`}
- **Description**: ${pageContext.description}`;
}

export function buildUserMessage(params: {
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  componentSkillMetadataBlock: string;
  technicalSkillMetadataBlock: string;
  sectionDesignBrief: string;
  /** When false, a component skill was selected — do not use describePageSections output as visual guidance. */
  useDescribePageBrief: boolean;
  layoutMode?: LayoutMode;
}) {
  const {
    projectContext,
    pageContext,
    section,
    componentSkillMetadataBlock,
    technicalSkillMetadataBlock,
    sectionDesignBrief,
    useDescribePageBrief,
    layoutMode,
  } = params;

  const wholePageModeBlock = buildWholePageModeBlock(layoutMode, useDescribePageBrief);

  const sectionDesignBriefBody = useDescribePageBrief
    ? sectionDesignBrief
    : `_(Omitted: a **component skill** in the system prompt is the primary layout and visual reference for this section. Rely on that skill, the design system, and the section intent / content hints below — not the separate page section description from the describe step.)_`;

  const closingGuidance = useDescribePageBrief
    ? `The Section Design Brief above is your primary visual guidance — follow its background and atmosphere direction closely.`
    : `The **component skill** in the system prompt is your primary layout and visual guide. Follow it with the design system and section intent.`;

  return `${wholePageModeBlock}## Project Context
- **Project**: ${projectContext.projectTitle}
- **Description**: ${projectContext.projectDescription}
- **Language**: ${projectContext.language} — ⚠️ CRITICAL: ALL user-facing text (headlines, buttons, copy, labels, alt text) MUST be written in this language. Do NOT mix with other languages. Skill examples showing English text are structural only — replace with real ${projectContext.language} content.

## Known Routes
**These are the ONLY valid routes. Navigation must use exactly these routes.**
${formatKnownRoutesBlock(projectContext.pages) || "- / (home)"}

${buildPageContextBlock(pageContext)}

## Section to Generate
- **Type**: ${section.type}
- **Component Name**: ${section.fileName}
- **Intent**: ${section.intent}
- **Content Hints**: ${section.contentHints}

## Section Design Brief
${sectionDesignBriefBody}

${componentSkillMetadataBlock ? `## Available Component Skills\nThe selected component skill (if any) is already included in the system prompt.\n${componentSkillMetadataBlock}` : ""}
${technicalSkillMetadataBlock ? `## Available Technical Skills\nThese are implementation guidance skills that may be layered with component skills.\n${technicalSkillMetadataBlock}` : ""}

Generate the complete ${section.fileName}.tsx component.
Use the design system and project context to make all design decisions (layout, visual style, motion, interaction).
${closingGuidance}`;
}
