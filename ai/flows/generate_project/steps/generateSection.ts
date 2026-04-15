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
import { stepDescribeSectionDesign } from "./describeSectionDesign";

export interface GenerateSectionParams {
  designSystem: string;
  projectGuardrailIds: GuardrailId[];
  projectContext: GenerateSectionProjectContext;
  section: PlannedSectionSpec;
  outputFileRelative: string;
  pageContext?: GenerateSectionPageContext;
  sectionDesignBriefOverride?: string;
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

/** Component skills in prompts/skills/ are hero-only; support common hero aliases from planners. */
function isHeroComponentSkillSectionType(section: PlannedSectionSpec): boolean {
  const sectionType = section.type.trim().toLowerCase();
  if (sectionType === "hero") return true;
  // Planner aliases seen in real outputs
  if (sectionType === "opening-shot" || sectionType === "opening_shot") return true;
  // Fallback guards: if name/intent clearly indicates hero, allow skill selection path.
  if (/^hero(section)?$/i.test(section.fileName.trim())) return true;
  if (/hero|opening shot|首屏|头图/i.test(section.intent)) return true;
  return false;
}

type SkillSelectionContext = {
  intent: string;
  contentHints: string;
  designKeywords: string[];
  productType: string;
  journeyStage?: string;
  rawUserInput?: string;
};

function scoreMatches(source: string, terms: string[] | undefined): number {
  if (!terms || terms.length === 0) return 0;
  let score = 0;
  for (const term of terms) {
    const t = term.trim().toLowerCase();
    if (!t) continue;
    if (source.includes(t)) {
      score += 1;
    }
  }
  return score;
}

function chooseSkillDeterministically(
  candidates: ReturnType<typeof discoverSkillsBySectionType>,
  context: SkillSelectionContext
): { skillId: string | null; strong: boolean } {
  const source = [
    context.rawUserInput ?? "",
    context.intent,
    context.contentHints,
    context.productType,
    context.journeyStage ?? "",
    context.designKeywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let bestId = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondBest = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    let score = candidate.priority;
    const when = candidate.when;

    score += scoreMatches(source, when?.designKeywords?.any) * 6;
    score += scoreMatches(source, when?.traits?.any) * 4;
    score += scoreMatches(source, when?.journeyStages?.any) * 3;
    score += scoreMatches(source, when?.productTypes?.any) * 3;

    score -= scoreMatches(source, when?.designKeywords?.none) * 8;
    score -= scoreMatches(source, when?.traits?.none) * 6;
    score -= scoreMatches(source, when?.journeyStages?.none) * 5;

    // Skill-specific boost for explicit visual effect signals.
    if (candidate.id.includes(".particle")) {
      score += scoreMatches(source, ["particle", "particles", "粒子", "粒子化", "point cloud", "canvas text"]) * 12;
    } else if (candidate.id.includes(".lighting")) {
      score += scoreMatches(source, ["lighting", "glow", "neon", "light beam", "光效", "霓虹", "辉光"]) * 8;
    } else if (candidate.id.includes(".dashboard")) {
      score += scoreMatches(source, ["dashboard", "analytics", "metrics", "数据看板", "仪表盘"]) * 8;
    }

    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestId = candidate.id;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  // Only auto-pick when signal is clear enough and winner margin is obvious.
  const strong = bestScore >= 10 && bestScore - secondBest >= 4;
  return { skillId: bestId || null, strong };
}

async function llmSelectSkill(
  candidates: ReturnType<typeof discoverSkillsBySectionType>,
  context: SkillSelectionContext
): Promise<string | null> {
  const skillList = candidates
    .map((c) => {
      const w = c.when;
      const parts = [`id: "${c.id}"`];
      if (c.notes) parts.push(`description: ${c.notes}`);
      if (w?.designKeywords?.any?.length) parts.push(`matches keywords: [${w.designKeywords.any.join(", ")}]`);
      if (w?.designKeywords?.none?.length) parts.push(`excludes keywords: [${w.designKeywords.none.join(", ")}]`);
      if (w?.traits?.any?.length) parts.push(`traits match: [${w.traits.any.join(", ")}]`);
      if (w?.traits?.none?.length) parts.push(`traits exclude: [${w.traits.none.join(", ")}]`);
      if (w?.journeyStages?.any?.length) parts.push(`journey stages match: [${w.journeyStages.any.join(", ")}]`);
      if (w?.journeyStages?.none?.length) parts.push(`journey stages exclude: [${w.journeyStages.none.join(", ")}]`);
      if (w?.productTypes?.any?.length) parts.push(`for product types: [${w.productTypes.any.join(", ")}]`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const systemPrompt = `Select at most ONE component skill for this hero section.

Rules:
1. If user intent clearly asks for a concrete visual effect (e.g. particle text, glow lighting, dashboard hero), choose the matching skill.
2. If there is no clear effect intent, return {"skillId": null}.
3. Do not use fallback thinking. Pick only when there is explicit or strongly implied alignment.
4. Prefer precision over novelty.

Return JSON only: {"skillId":"<id>"|null}`;

  const userMessage = `Section intent: ${context.intent}
Section content hints: ${context.contentHints}
Design keywords: ${context.designKeywords.join(", ")}
Product type: ${context.productType}
Journey stage: ${context.journeyStage ?? ""}
Original user request: ${context.rawUserInput ?? ""}

Candidate skills:
${skillList}`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0,
      128,
      getModelForStep("preselect_skills")
    );
    const parsed = JSON.parse(extractJSON(raw)) as { skillId?: string | null };
    const id = typeof parsed.skillId === "string" ? parsed.skillId.trim() : "";
    if (!id) return null;
    return candidates.some((c) => c.id === id) ? id : null;
  } catch {
    return null;
  }
}

async function discoverAndSelectSkill(
  sectionType: string,
  context: SkillSelectionContext,
  section: PlannedSectionSpec
): Promise<{ skillId: string | null; skillPrompt: string; skillMetadataBlock: string }> {
  if (!isHeroComponentSkillSectionType(section)) {
    return { skillId: null, skillPrompt: "", skillMetadataBlock: "" };
  }

  const root = getSkillPromptsRoot();
  const normalizedType = sectionType.trim().toLowerCase();
  const skillSectionType =
    normalizedType === "opening-shot" || normalizedType === "opening_shot" ? "hero" : normalizedType;
  const candidates = discoverSkillsBySectionType(root, skillSectionType);

  if (candidates.length === 0) {
    return { skillId: null, skillPrompt: "", skillMetadataBlock: "" };
  }

  const metadataBlock = candidates
    .map((c) => `- **${c.id}** (priority: ${c.priority}${c.fallback ? ", fallback" : ""}): ${c.notes || "no description"}`)
    .join("\n");

  const deterministic = chooseSkillDeterministically(candidates, context);
  if (deterministic.skillId && deterministic.strong) {
    console.log(`[skill-select] deterministic strong match "${deterministic.skillId}" for ${sectionType}`);
    return {
      skillId: deterministic.skillId,
      skillPrompt: loadSkillPrompt(deterministic.skillId),
      skillMetadataBlock: metadataBlock,
    };
  }

  const llmChoice = await llmSelectSkill(candidates, context);
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
  designSystem: string;
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  skillMetadataBlock: string;
  sectionDesignBrief: string;
}) {
  const { designSystem, projectContext, pageContext, section, skillMetadataBlock, sectionDesignBrief } = params;

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

**Custom effects** — Use Tailwind utilities/arbitrary values (no prefixed helper classes):
- Glass/blur effects → \`backdrop-blur-*\`, translucent backgrounds, border/opacity utilities
- Clip-path shapes → \`[clip-path:polygon(...)]\`
- Texture overlays → gradients/noise via Tailwind utilities and arbitrary values

**Do NOT** define inline CSS variables, @keyframes, or custom classes that duplicate design system tokens. Trust that the Tailwind utilities exist.

## Project Context
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
Use the design system and project context to make all design decisions (layout, visual style, motion, interaction). Apply the Tailwind CSS mapping rules above to translate design tokens into utility classes.
The Section Design Brief above is your primary visual guidance — follow its background, and atmosphere direction closely.`;
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
    sectionDesignBriefOverride,
  } = params;
  const { skillId, skillPrompt, skillMetadataBlock } = isSectionSkillsEnabled()
    ? await discoverAndSelectSkill(section.type, {
      intent: section.intent,
      contentHints: section.contentHints,
      designKeywords: projectContext.designKeywords,
      productType: "",
      journeyStage: pageContext?.journeyStage,
      rawUserInput: projectContext.rawUserInput,
    }, section)
    : { skillId: null, skillPrompt: "", skillMetadataBlock: "" };

  const systemPrompt = buildSystemPrompt({
    section,
    projectGuardrailIds,
    skillPrompt,
  });

  const sectionDesignBrief = sectionDesignBriefOverride?.trim()
    ? sectionDesignBriefOverride
    : await stepDescribeSectionDesign({
      section,
      designSystem,
    });

  const userMessage = buildUserMessage({
    designSystem,
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
