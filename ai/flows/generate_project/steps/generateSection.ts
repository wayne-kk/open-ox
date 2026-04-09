import {
  formatSiteFile,
  getSkillPromptsRoot,
  loadGuardrail,
  loadSectionPrompt,
  loadSkillPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { selectSectionPromptId } from "../selectors/sectionPromptSelector";
import { callLLM, callLLMWithTools, extractContent, extractJSON } from "../shared/llm";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import { createImageExecutor } from "../../../tools/system/generateImageTool";
import type { PendingImage } from "../../../tools/system/generateImageTool";
import {
  discoverSkillsBySectionType,
} from "../../../shared/skillDiscovery";
import type {
  CapabilitySpec,
  GuardrailId,
  PageDesignPlan,
  ProductScope,
  TaskLoop,
  UserRole,
  PlannedSectionSpec,
  StepTrace,
} from "../types";
import { inferSectionGuardrailDefaults } from "../planners/guardrailPolicy";

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
  language: string;
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
  designKeywords: string[];
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

// ── Skill Discovery (runtime, per-section) ──────────────────────────────

/**
 * Use LLM to select the best skill for a section.
 * Returns the skill id or null if LLM fails.
 */
async function llmSelectSkill(
  candidates: ReturnType<typeof discoverSkillsBySectionType>,
  context: { intent: string; contentHints: string; designKeywords: string[]; productType: string }
): Promise<string | null> {
  const skillList = candidates.map((c) => {
    const w = c.when;
    const parts = [`id: "${c.id}"`];
    if (c.fallback) parts.push("(FALLBACK — only use when no specialized skill matches)");
    if (c.notes) parts.push(`description: ${c.notes}`);
    if (w?.designKeywords?.any?.length) parts.push(`matches keywords: [${w.designKeywords.any.join(", ")}]`);
    if (w?.designKeywords?.none?.length) parts.push(`excludes keywords: [${w.designKeywords.none.join(", ")}]`);
    if (w?.productTypes?.any?.length) parts.push(`for product types: [${w.productTypes.any.join(", ")}]`);
    return `- ${parts.join(" | ")}`;
  }).join("\n");

  const systemPrompt = `You select the best component skill for a UI section. You will receive the section's context and a list of candidate skills.

Selection rules (in priority order):
1. Match the section's INTENT and CONTENT HINTS against each skill's description and keyword triggers. A skill whose keywords appear in (or are semantically equivalent to) the section context is the right choice.
2. Skills marked FALLBACK are generic catch-alls. NEVER pick a fallback skill when a specialized skill's keywords match the section context — even partially or in a different language.
3. When multiple specialized skills match, prefer the one with more keyword overlap.
4. Only pick the fallback when NO specialized skill has any keyword relevance to the section.

Respond with JSON only: {"skillId": "<id>"}`;

  const userMessage = `## Section
- Intent: ${context.intent}
- Content Hints: ${context.contentHints}
- Design Keywords: ${context.designKeywords.join(", ")}
- Product Type: ${context.productType}

## Candidate Skills
${skillList}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0, 1024);
    const parsed = JSON.parse(extractJSON(raw)) as { skillId?: string };
    if (parsed.skillId && candidates.some((c) => c.id === parsed.skillId)) {
      return parsed.skillId;
    }
  } catch {
    // LLM failed — fall through
  }
  return null;
}

async function discoverAndSelectSkill(
  sectionType: string,
  context: { intent: string; contentHints: string; designKeywords: string[]; productType: string }
): Promise<{ skillId: string | null; skillPrompt: string; skillMetadataBlock: string }> {
  const root = getSkillPromptsRoot();
  const candidates = discoverSkillsBySectionType(root, sectionType);

  if (candidates.length === 0) {
    return { skillId: null, skillPrompt: "", skillMetadataBlock: "" };
  }

  const metadataBlock = candidates
    .map((c) => `- **${c.id}** (priority: ${c.priority}${c.fallback ? ", fallback" : ""}): ${c.notes || "no description"}`)
    .join("\n");

  // If only one candidate, skip selection
  if (candidates.length === 1) {
    return {
      skillId: candidates[0].id,
      skillPrompt: loadSkillPrompt(candidates[0].id),
      skillMetadataBlock: metadataBlock,
    };
  }

  // LLM-based selection
  const llmChoice = await llmSelectSkill(candidates, context);
  if (llmChoice) {
    console.log(`[skill-select] LLM chose "${llmChoice}" for ${sectionType}`);
    return {
      skillId: llmChoice,
      skillPrompt: loadSkillPrompt(llmChoice),
      skillMetadataBlock: metadataBlock,
    };
  }

  // Fallback: use the skill marked as fallback, or first by priority
  const fallback = candidates.find((c) => c.fallback) ?? candidates[0];
  console.log(`[skill-select] Fallback to "${fallback.id}" for ${sectionType}`);

  return {
    skillId: fallback.id,
    skillPrompt: loadSkillPrompt(fallback.id),
    skillMetadataBlock: metadataBlock,
  };
}

// ── Guardrail Assembly ──────────────────────────────────────────────────

function buildGuardrailBlocks(projectGuardrailIds: GuardrailId[], section: PlannedSectionSpec) {
  const sectionDefaults = inferSectionGuardrailDefaults(section);
  const allIds = Array.from(new Set([...projectGuardrailIds, ...sectionDefaults]));
  return allIds.map((id) => loadGuardrail(id)).join("\n\n");
}

// ── Section Prompt ──────────────────────────────────────────────────────

function buildSectionPromptBlocks(sectionType: string) {
  const sectionPromptId = selectSectionPromptId(sectionType);
  return [
    loadSectionPrompt("section.default"),
    sectionPromptId !== "section.default" ? loadSectionPrompt(sectionPromptId) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── System Prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(params: {
  section: PlannedSectionSpec;
  projectGuardrailIds: GuardrailId[];
  skillPrompt: string;
}): string {
  const { section, projectGuardrailIds, skillPrompt } = params;

  return [
    loadSystem("frontend"),
    buildSectionPromptBlocks(section.type),
    skillPrompt,
    buildGuardrailBlocks(projectGuardrailIds, section),
    loadGuardrail("outputTsx"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Formatting Helpers ──────────────────────────────────────────────────

function formatRolesBlock(roles: UserRole[]) {
  return roles
    .map((r) => `- ${r.roleName} (${r.roleId}): ${r.summary}\n  - Goals: ${r.goals.join(" | ")}\n  - Core Actions: ${r.coreActions.join(" | ")}`)
    .join("\n");
}

function formatTaskLoopsBlock(taskLoops: TaskLoop[]) {
  return taskLoops
    .map((l) => `- ${l.name} (${l.loopId})\n  - Role: ${l.roleId}\n  - Trigger: ${l.entryTrigger}\n  - Steps: ${l.steps.join(" -> ")}\n  - Success: ${l.successState}`)
    .join("\n");
}

function formatCapabilitiesBlock(capabilities: CapabilitySpec[]) {
  return capabilities
    .map((c) => `- ${c.name} (${c.capabilityId})\n  - Summary: ${c.summary}\n  - Roles: ${c.primaryRoleIds.join(", ") || "none"}`)
    .join("\n");
}

function formatKnownRoutesBlock(pages: GenerateSectionProjectContext["pages"]) {
  return pages
    .map((p) => `- ${p.title} (${p.slug}): ${p.slug === "home" ? "/" : `/${p.slug}`} — ${p.description} [${p.journeyStage}]`)
    .join("\n");
}

function filterRelevantRoles(section: PlannedSectionSpec, ctx: GenerateSectionProjectContext, page?: GenerateSectionPageContext) {
  const ids = new Set([...section.primaryRoleIds, ...(page?.primaryRoleIds ?? [])]);
  return ctx.roles.filter((r) => ids.has(r.roleId));
}

function filterRelevantTaskLoops(section: PlannedSectionSpec, ctx: GenerateSectionProjectContext) {
  const ids = new Set(section.sourceTaskLoopIds);
  return ctx.taskLoops.filter((l) => ids.has(l.loopId));
}

function filterRelevantCapabilities(section: PlannedSectionSpec, ctx: GenerateSectionProjectContext, page?: GenerateSectionPageContext) {
  const ids = new Set([...section.supportingCapabilityIds, ...(page?.supportingCapabilityIds ?? [])]);
  return ctx.capabilities.filter((c) => ids.has(c.capabilityId));
}

function buildPageContextBlock(pageContext?: GenerateSectionPageContext) {
  if (!pageContext) {
    return `## Page Context\nThis is a shared layout section. Design it to work coherently across the whole project.`;
  }
  const p = pageContext.pageDesignPlan;
  return `## Page Context
- **Title**: ${pageContext.title}
- **Route**: ${pageContext.slug === "home" ? "/" : `/${pageContext.slug}`}
- **Description**: ${pageContext.description}
- **Journey Stage**: ${pageContext.journeyStage}

## Page Design Plan
- **Page Goal**: ${p.pageGoal}
- **Narrative Arc**: ${p.narrativeArc}
- **Layout Strategy**: ${p.layoutStrategy}
- **Hierarchy**: ${p.hierarchy.join(" | ")}`;
}

// ── User Message ────────────────────────────────────────────────────────

function buildUserMessage(params: {
  designSystem: string;
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  skillMetadataBlock: string;
}) {
  const { designSystem, projectContext, pageContext, section, skillMetadataBlock } = params;
  const roles = filterRelevantRoles(section, projectContext, pageContext);
  const loops = filterRelevantTaskLoops(section, projectContext);
  const caps = filterRelevantCapabilities(section, projectContext, pageContext);

  return `## Design System
${designSystem}

## Design System → Tailwind CSS v4 Mapping Guide
The design system above is the single source of truth. A separate build step converts it into \`globals.css\` with Tailwind v4 tokens. When writing component classes, follow these mapping rules:

**Colors** — Design system color names map directly to Tailwind utilities:
- A color named "accent" / "primary" / "background" etc. → use \`bg-accent\`, \`text-primary\`, \`border-background\` etc.
- Pattern: \`--color-{name}\` in @theme → \`bg-{name}\`, \`text-{name}\`, \`border-{name}\`

**Fonts** — Font names map to \`font-{name}\`:
- "display" font → \`font-display\`, "body" font → \`font-body\`, "header" font → \`font-header\`

**Shadows** — Named shadows map to \`shadow-{name}\`:
- "glow" shadow → \`shadow-glow\`, "soft" shadow → \`shadow-soft\`

**Animations** — Named animations map to \`animate-{name}\`:
- "float" animation → \`animate-float\`, "pulse" animation → \`animate-pulse\`

**Custom effects** — Composite effects use \`ds-\` prefix:
- Glass/blur effects → \`ds-glass\`, clip-path shapes → \`ds-chamfer\`, texture overlays → \`ds-scanlines\`

**Do NOT** define inline CSS variables, @keyframes, or custom classes that duplicate design system tokens. Trust that the Tailwind utilities exist.

## Project Context
- **Project**: ${projectContext.projectTitle}
- **Description**: ${projectContext.projectDescription}
- **Language**: ${projectContext.language} — ⚠️ CRITICAL: ALL user-facing text (headlines, buttons, copy, labels, alt text) MUST be written in this language. Do NOT mix with other languages. Skill examples showing English text are structural only — replace with real ${projectContext.language} content.
- **Product Type**: ${projectContext.productScope.productType}
- **Core Outcome**: ${projectContext.productScope.coreOutcome}
- **Business Goal**: ${projectContext.productScope.businessGoal}

## Roles
${formatRolesBlock(roles) || "- none"}

## Task Loops
${formatTaskLoopsBlock(loops) || "- none"}

## Capabilities
${formatCapabilitiesBlock(caps) || "- none"}

## Known Routes
**These are the ONLY valid routes. Navigation must use exactly these routes.**
${formatKnownRoutesBlock(projectContext.pages) || "- / (home)"}

${buildPageContextBlock(pageContext)}

## Section to Generate
- **Type**: ${section.type}
- **Component Name**: ${section.fileName}
- **Intent**: ${section.intent}
- **Content Hints**: ${section.contentHints}
- **Primary Roles**: ${section.primaryRoleIds.join(", ") || "none"}
- **Supporting Capabilities**: ${section.supportingCapabilityIds.join(", ") || "none"}

${skillMetadataBlock ? `## Available Component Skills\nThe following skills are available for this section type. The selected skill's full guidance is already in the system prompt.\n${skillMetadataBlock}` : ""}

Generate the complete ${section.fileName}.tsx component.
Use the design system and project context to make all design decisions (layout, visual style, motion, interaction). Apply the Tailwind CSS mapping rules above to translate design tokens into utility classes. The section intent and content hints define WHAT to build; YOU decide HOW it looks.`;
}

// ── Validation ──────────────────────────────────────────────────────────

export interface GenerateSectionResult {
  filePath: string;
  skillId: string | null;
  trace: StepTrace;
  pendingImages: PendingImage[];
}

function validateSectionExports(tsx: string, componentName: string): NonNullable<StepTrace["validationResult"]> {
  const checks: Array<{ name: string; passed: boolean; detail?: string }> = [];
  checks.push({ name: "non_empty", passed: tsx.trim().length > 0, detail: tsx.trim().length === 0 ? "Generated content is empty" : undefined });
  const hasNamedExport = new RegExp(`export\\s+(function|const|class)\\s+${componentName}\\b`).test(tsx);
  const hasDefaultExport = /export\s+default\s+/.test(tsx);
  checks.push({ name: "has_export", passed: hasNamedExport || hasDefaultExport, detail: !hasNamedExport && !hasDefaultExport ? `No export found for "${componentName}".` : undefined });
  const hasJsx = /return\s*\(?\s*</.test(tsx);
  checks.push({ name: "has_jsx", passed: hasJsx, detail: !hasJsx ? "No JSX return statement found" : undefined });
  return { passed: checks.every((c) => c.passed), checks };
}

// ── Main Entry ──────────────────────────────────────────────────────────

export async function stepGenerateSection({
  designSystem,
  projectGuardrailIds,
  projectContext,
  section,
  outputFileRelative,
  pageContext,
}: GenerateSectionParams): Promise<GenerateSectionResult> {
  const { skillId, skillPrompt, skillMetadataBlock } = await discoverAndSelectSkill(section.type, {
    intent: section.intent,
    contentHints: section.contentHints,
    designKeywords: projectContext.designKeywords,
    productType: projectContext.productScope.productType,
  });

  const systemPrompt = buildSystemPrompt({
    section,
    projectGuardrailIds,
    skillPrompt,
  });

  const userMessage = buildUserMessage({
    designSystem,
    projectContext,
    pageContext,
    section,
    skillMetadataBlock,
  });

  const componentName = section.fileName.replace(/\.tsx$/, "");
  const filePath = outputFileRelative;
  const sectionModel = getModelForStep("generate_section");
  const sectionThinkingLevel = getThinkingLevelForStep("generate_section");
  const MAX_RETRIES = 1;
  let lastError = "";

  const imageTools = getSystemToolDefinitions(["generate_image"]);
  const { executor: imageExecutor, pendingImages } = createImageExecutor(componentName);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const retryHint = attempt > 0
      ? `\n\nIMPORTANT: Your previous response was truncated/incomplete — the component "${componentName}" was missing its export or JSX return. Output the COMPLETE component with \`export function ${componentName}\` and a JSX return. Keep it concise.`
      : "";

    const llmResult = await callLLMWithTools({
      systemPrompt: systemPrompt + retryHint,
      userMessage,
      tools: imageTools,
      temperature: 0.7,
      maxIterations: 6,
      model: sectionModel,
      ...(sectionThinkingLevel ? { thinkingLevel: sectionThinkingLevel } : {}),
      executeToolOverrides: {
        generate_image: imageExecutor,
      },
    });

    const tsx = extractContent(llmResult.content, "tsx");

    await writeSiteFile(filePath, tsx);
    await formatSiteFile(filePath);

    const validationResult = validateSectionExports(tsx, componentName);

    const generatedImages = pendingImages.map((img) => ({
      filename: img.filename,
      prompt: img.prompt,
      path: img.publicPath,
      durationMs: img.durationMs,
    }));

    const trace: StepTrace = {
      input: {
        sectionType: section.type,
        componentName,
        outputFile: outputFileRelative,
        skillId,
        pageContext: pageContext ? { slug: pageContext.slug, title: pageContext.title } : null,
      },
      output: {
        filePath,
        linesGenerated: tsx.split("\n").length,
        validationPassed: validationResult.passed,
        generatedImages,
      },
      llmCall: {
        model: sectionModel,
        thinkingLevel: sectionThinkingLevel,
        systemPrompt: systemPrompt + retryHint,
        userMessage,
        rawResponse: llmResult.content,
      },
      validationResult,
    };

    if (validationResult.passed) {
      return { filePath, skillId, trace, pendingImages };
    }

    lastError = validationResult.checks.filter((c) => !c.passed).map((c) => c.detail ?? c.name).join("; ");
    if (attempt < MAX_RETRIES) {
      console.warn(`[generateSection] ${componentName} validation failed (attempt ${attempt + 1}), retrying: ${lastError}`);
    }
  }

  throw new Error(`Section validation failed for ${componentName}: ${lastError}`);
}
