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
import { getModelForStep, getThinkingLevelForStep, isSectionSkillsEnabled } from "@/lib/config/models";
import { getSystemToolDefinitions } from "../../../tools/systemToolCatalog";
import { createImageExecutor } from "../../../tools/system/generateImageTool";
import type { PendingImage } from "../../../tools/system/generateImageTool";
import {
  discoverSkillsBySectionType,
} from "../../../shared/skillDiscovery";
import type {
  GuardrailId,
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
  sectionDesignBrief: string;
  /** Optional: callback to collect conversation messages for trajectory logging */
  onMessage?: (msg: import("@/ai/shared/llm/types").ChatMessage) => void;
}

type GenerateSectionProjectContext = {
  projectTitle: string;
  projectDescription: string;
  language: string;
  rawUserInput?: string;
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
};

// ── Skill Discovery (runtime, per-section) ──────────────────────────────

async function llmSelectSkill(
  candidates: ReturnType<typeof discoverSkillsBySectionType>,
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<string | null> {
  const skillList = candidates
    .map((c) => {
      const w = c.when;
      const parts = [`id: "${c.id}"`];
      if (c.notes) parts.push(`description: ${c.notes}`);
      if (w?.designKeywords?.any?.length) parts.push(`matches keywords: [${w.designKeywords.any.join(", ")}]`);
      if (w?.designKeywords?.none?.length) parts.push(`excludes keywords: [${w.designKeywords.none.join(", ")}]`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const systemPrompt = `Select at most ONE component skill for this section.

Rules:
1. The original user request is the highest-priority signal. If the user explicitly mentions a visual effect (e.g. "闪电效果", "粒子效果", "shader", "lightning"), you MUST select the matching skill even if the design keywords seem generic.
2. If user intent clearly asks for a concrete visual effect, choose the matching skill.
3. If there is no clear match, return {"skillId": null}.
4. Prefer precision over novelty.
5. Match Chinese visual terms to English skill keywords: 闪电/雷电/电光→lightning, 粒子→particle, 着色器→shader, etc.

Return JSON only: {"skillId":"<id>"|null}`;

  const userMessage = `Original user request (HIGHEST PRIORITY): ${rawUserInput ?? "N/A"}

Section type: ${section.type}
Section intent: ${section.intent}
Section content hints: ${section.contentHints}
Design keywords: ${designKeywords.join(", ")}

Candidate skills:
${skillList}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0, 128, getModelForStep("preselect_skills"));
    const parsed = JSON.parse(extractJSON(raw)) as { skillId?: string | null };
    const id = typeof parsed.skillId === "string" ? parsed.skillId.trim() : "";
    if (!id) return null;
    return candidates.some((c) => c.id === id) ? id : null;
  } catch {
    return null;
  }
}

async function discoverAndSelectSkill(
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<{ skillId: string | null; skillPrompt: string; skillMetadataBlock: string }> {
  const sectionType = section.type.trim().toLowerCase();
  const root = getSkillPromptsRoot();
  const candidates = discoverSkillsBySectionType(root, sectionType);

  console.log(`[skill-select] sectionType="${sectionType}" root="${root}" candidates=${candidates.length} ids=[${candidates.map(c => c.id).join(",")}]`);

  if (candidates.length === 0) {
    return { skillId: null, skillPrompt: "", skillMetadataBlock: "" };
  }

  const metadataBlock = candidates
    .map((c) => `- **${c.id}** (priority: ${c.priority}${c.fallback ? ", fallback" : ""}): ${c.notes || "no description"}`)
    .join("\n");

  const llmChoice = await llmSelectSkill(candidates, section, designKeywords, rawUserInput);
  if (llmChoice) {
    console.log(`[skill-select] llm choice "${llmChoice}" for ${sectionType}`);
    return {
      skillId: llmChoice,
      skillPrompt: loadSkillPrompt(llmChoice),
      skillMetadataBlock: metadataBlock,
    };
  }

  console.log(`[skill-select] No component skill selected for ${sectionType}`);
  return { skillId: null, skillPrompt: "", skillMetadataBlock: "" };
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

const TAILWIND_MAPPING_GUIDE = `## Design System → Tailwind CSS v4 Mapping Guide

The design system is the single source of truth. A separate build step converts it into \`globals.css\` with Tailwind v4 tokens. When writing component classes, follow these mapping rules:

**Colors** — Design system color names map directly to Tailwind utilities:
- A color named "accent" / "primary" / "background" etc. → use \`bg-accent\`, \`text-primary\`, \`border-background\` etc.
- Pattern: \`--color-{name}\` in @theme → \`bg-{name}\`, \`text-{name}\`, \`border-{name}\`

**Fonts** — Font names map to \`font-{name}\`:
- "display" font → \`font-display\`, "body" font → \`font-body\`, "header" font → \`font-header\`

**Shadows** — Named shadows map to \`shadow-{name}\`:
- "glow" shadow → \`shadow-glow\`, "soft" shadow → \`shadow-soft\`

**Animations** — Named animations map to \`animate-{name}\`:
- "float" animation → \`animate-float\`, "pulse" animation → \`animate-pulse\`

**Custom effects** — Use Tailwind utilities/arbitrary values (no prefixed helper classes):
- Glass/blur effects → \`backdrop-blur-*\`, translucent backgrounds, border/opacity utilities
- Clip-path shapes → \`[clip-path:polygon(...)]\`
- Texture overlays → gradients/noise via Tailwind utilities and arbitrary values

**Do NOT** define inline CSS variables, @keyframes, or custom classes that duplicate design system tokens. Trust that the Tailwind utilities exist.`;

function buildSystemPrompt(params: {
  section: PlannedSectionSpec;
  projectGuardrailIds: GuardrailId[];
  skillPrompt: string;
  designSystem: string;
}): string {
  const { section, projectGuardrailIds, skillPrompt, designSystem } = params;

  return [
    loadSystem("frontend"),
    `## Design System\n${designSystem}`,
    TAILWIND_MAPPING_GUIDE,
    buildSectionPromptBlocks(section.type),
    skillPrompt,
    buildGuardrailBlocks(projectGuardrailIds, section),
    loadGuardrail("outputTsx"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Formatting Helpers ──────────────────────────────────────────────────

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

// ── User Message ────────────────────────────────────────────────────────

function buildUserMessage(params: {
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  skillMetadataBlock: string;
  sectionDesignBrief: string;
}) {
  const { projectContext, pageContext, section, skillMetadataBlock, sectionDesignBrief } = params;

  return `## Project Context
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
${sectionDesignBrief}

${skillMetadataBlock ? `## Available Component Skills\nThe following skills are available for this section type. The selected skill's full guidance is already in the system prompt.\n${skillMetadataBlock}` : ""}

Generate the complete ${section.fileName}.tsx component.
Use the design system and project context to make all design decisions (layout, visual style, motion, interaction).
The Section Design Brief above is your primary visual guidance — follow its background and atmosphere direction closely.`;
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

export async function stepGenerateSection(params: GenerateSectionParams): Promise<GenerateSectionResult> {
  const {
    designSystem,
    projectGuardrailIds,
    projectContext,
    section,
    outputFileRelative,
    pageContext,
    sectionDesignBrief,
  } = params;
  const { skillId, skillPrompt, skillMetadataBlock } = isSectionSkillsEnabled()
    ? await discoverAndSelectSkill(
      section,
      projectContext.designKeywords,
      projectContext.rawUserInput,
    )
    : { skillId: null, skillPrompt: "", skillMetadataBlock: "" };

  const systemPrompt = buildSystemPrompt({
    section,
    projectGuardrailIds,
    skillPrompt,
    designSystem,
  });

  const userMessage = buildUserMessage({
    projectContext,
    pageContext,
    section,
    skillMetadataBlock,
    sectionDesignBrief,
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
      onMessage: params.onMessage,
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
