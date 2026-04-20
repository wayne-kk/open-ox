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
  discoverSkills,
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

interface ComponentSkillScore {
  id: string;
  priority: number;
  score: number;
  reasons: string[];
  matchedKeywords: string[];
  excludedKeywords: string[];
}

function scoreComponentCandidate(
  candidate: ReturnType<typeof discoverSkillsBySectionType>[number],
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): ComponentSkillScore {
  const searchableText = [
    rawUserInput ?? "",
    section.intent,
    section.contentHints,
    ...designKeywords,
  ]
    .join(" ")
    .toLowerCase();

  const anyKeywords = candidate.when?.designKeywords?.any ?? [];
  const noneKeywords = candidate.when?.designKeywords?.none ?? [];
  const matchedKeywords = anyKeywords.filter((kw) => searchableText.includes(kw.toLowerCase()));
  const excludedKeywords = noneKeywords.filter((kw) => searchableText.includes(kw.toLowerCase()));

  const reasons: string[] = [];
  let score = 0;
  const priority = Math.max(0, candidate.priority ?? 0);

  if (anyKeywords.length > 0) {
    const coverage = matchedKeywords.length / anyKeywords.length;
    const coverageScore = Math.round(priority * 0.75 * coverage);
    score += coverageScore;
    reasons.push(`keyword coverage ${matchedKeywords.length}/${anyKeywords.length} (+${coverageScore})`);
  } else {
    const baseline = Math.round(priority * 0.35);
    score += baseline;
    reasons.push(`no positive keywords configured (+${baseline})`);
  }

  const sectionAffinity = Math.round(priority * 0.15);
  score += sectionAffinity;
  reasons.push(`section type affinity (${section.type}) (+${sectionAffinity})`);

  if (matchedKeywords.length > 0) {
    const confidenceBonus = Math.round(priority * 0.1);
    score += confidenceBonus;
    reasons.push(`explicit keyword hits: ${matchedKeywords.join(", ")} (+${confidenceBonus})`);
  }

  if (excludedKeywords.length > 0) {
    const penalty = Math.round(priority * 0.4);
    score -= penalty;
    reasons.push(`excluded keywords hit: ${excludedKeywords.join(", ")} (-${penalty})`);
  }

  const maxScore = Math.max(0, priority - 1);
  const boundedScore = Math.min(maxScore, Math.max(0, score));
  reasons.push(`bounded score ${boundedScore}/${priority}`);

  return {
    id: candidate.id,
    priority,
    score: boundedScore,
    reasons,
    matchedKeywords,
    excludedKeywords,
  };
}

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

Decision policy:
1. Evaluate all candidate skills holistically using user request, section intent, content hints, and design keywords.
2. Choose a skill only when there is clear evidence it is the best fit for this section.
3. If confidence is low or multiple skills are similarly plausible, return {"skillId": null}.
4. Do not infer or output any skill that is not in Candidate skills.
5. Prefer precision over novelty.

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

async function llmSelectTechnicalSkills(
  candidates: ReturnType<typeof discoverSkillsBySectionType>,
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
  selectedComponentSkillId?: string | null,
): Promise<string[]> {
  if (candidates.length === 0) return [];

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

  const systemPrompt = `Select technical guidance skills that can be layered ON TOP OF component skills.

Rules:
1. Technical skills are complementary implementation guidance; they can co-exist with a component skill.
2. Select only skills that are strongly justified by user intent or section visual intent.
3. If no technical skill is clearly needed, return {"skillIds": []}.
4. Prefer precision and keep selection minimal (0-2 skills).
5. Match Chinese terms: 三维/3D/Three.js→three, WebGL→webgl, 着色器→shader, 动画系统→animation.

Return JSON only: {"skillIds":["<id>", "..."]}`;

  const userMessage = `Original user request (highest priority): ${rawUserInput ?? "N/A"}

Section type: ${section.type}
Section intent: ${section.intent}
Section content hints: ${section.contentHints}
Design keywords: ${designKeywords.join(", ")}
Selected component skill: ${selectedComponentSkillId ?? "none"}

Candidate technical skills:
${skillList}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0, 256, getModelForStep("preselect_skills"));
    const parsed = JSON.parse(extractJSON(raw)) as { skillIds?: unknown };
    const skillIds = Array.isArray(parsed.skillIds) ? parsed.skillIds : [];
    const candidateIds = new Set(candidates.map((c) => c.id));
    return skillIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && candidateIds.has(id));
  } catch {
    return [];
  }
}

async function discoverAndSelectSkill(
  section: PlannedSectionSpec,
  designKeywords: string[],
  rawUserInput?: string,
): Promise<{
  componentSkillId: string | null;
  componentSkillPrompt: string;
  componentSkillMetadataBlock: string;
  technicalSkillIds: string[];
  technicalSkillPrompts: string[];
  technicalSkillMetadataBlock: string;
  componentSkillScores: ComponentSkillScore[];
}> {
  const sectionType = section.type.trim().toLowerCase();
  const root = getSkillPromptsRoot();
  const sectionCandidates = discoverSkillsBySectionType(root, sectionType);
  const allSkills = discoverSkills(root);
  const technicalCandidates = allSkills.filter((c) => c.kind === "technical-spec-skill");

  console.log(
    `[skill-select] sectionType="${sectionType}" root="${root}" sectionCandidates=${sectionCandidates.length} technicalCandidates=${technicalCandidates.length}`
  );

  if (sectionCandidates.length === 0 && technicalCandidates.length === 0) {
    return {
      componentSkillId: null,
      componentSkillPrompt: "",
      componentSkillMetadataBlock: "",
      technicalSkillIds: [],
      technicalSkillPrompts: [],
      technicalSkillMetadataBlock: "",
      componentSkillScores: [],
    };
  }

  const componentCandidates = sectionCandidates.filter((c) => !c.kind || c.kind === "component-skill");

  const componentMetadataBlock = componentCandidates
    .map((c) => `- **${c.id}** (priority: ${c.priority}${c.fallback ? ", fallback" : ""}): ${c.notes || "no description"}`)
    .join("\n");

  const componentSkillScores = componentCandidates
    .filter((c) => (c.priority ?? 0) > 60)
    .map((candidate) => scoreComponentCandidate(candidate, section, designKeywords, rawUserInput))
    .sort((a, b) => b.score - a.score);

  const technicalMetadataBlock = technicalCandidates
    .map((c) => `- **${c.id}** (priority: ${c.priority}${c.fallback ? ", fallback" : ""}): ${c.notes || "no description"}`)
    .join("\n");

  const llmChoice = await llmSelectSkill(componentCandidates, section, designKeywords, rawUserInput);
  const technicalChoices = await llmSelectTechnicalSkills(
    technicalCandidates,
    section,
    designKeywords,
    rawUserInput,
    llmChoice
  );

  const technicalSkillPrompts = technicalChoices.map((id) => loadSkillPrompt(id));

  if (llmChoice) {
    console.log(`[skill-select] llm component choice "${llmChoice}" for ${sectionType}`);
    if (technicalChoices.length > 0) {
      console.log(`[skill-select] llm technical choices [${technicalChoices.join(",")}] for ${sectionType}`);
    }
    return {
      componentSkillId: llmChoice,
      componentSkillPrompt: loadSkillPrompt(llmChoice),
      componentSkillMetadataBlock: componentMetadataBlock,
      technicalSkillIds: technicalChoices,
      technicalSkillPrompts,
      technicalSkillMetadataBlock: technicalMetadataBlock,
      componentSkillScores,
    };
  }

  if (technicalChoices.length > 0) {
    console.log(`[skill-select] no component skill; technical choices [${technicalChoices.join(",")}] for ${sectionType}`);
  } else {
    console.log(`[skill-select] No component/technical skill selected for ${sectionType}`);
  }
  return {
    componentSkillId: null,
    componentSkillPrompt: "",
    componentSkillMetadataBlock: componentMetadataBlock,
    technicalSkillIds: technicalChoices,
    technicalSkillPrompts,
    technicalSkillMetadataBlock: technicalMetadataBlock,
    componentSkillScores,
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
  skillPrompts: string[];
  designSystem: string;
}): string {
  const { section, projectGuardrailIds, skillPrompts, designSystem } = params;
  const selectedSkillPromptBlock = skillPrompts.filter(Boolean).join("\n\n");

  return [
    loadSystem("frontend"),
    `## Design System\n${designSystem}`,
    TAILWIND_MAPPING_GUIDE,
    buildSectionPromptBlocks(section.type),
    selectedSkillPromptBlock,
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
  componentSkillMetadataBlock: string;
  technicalSkillMetadataBlock: string;
  sectionDesignBrief: string;
}) {
  const {
    projectContext,
    pageContext,
    section,
    componentSkillMetadataBlock,
    technicalSkillMetadataBlock,
    sectionDesignBrief,
  } = params;

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

${componentSkillMetadataBlock ? `## Available Component Skills\nThe selected component skill (if any) is already included in the system prompt.\n${componentSkillMetadataBlock}` : ""}
${technicalSkillMetadataBlock ? `## Available Technical Skills\nThese are implementation guidance skills that may be layered with component skills.\n${technicalSkillMetadataBlock}` : ""}

Generate the complete ${section.fileName}.tsx component.
Use the design system and project context to make all design decisions (layout, visual style, motion, interaction).
The Section Design Brief above is your primary visual guidance — follow its background and atmosphere direction closely.`;
}

// ── Validation ──────────────────────────────────────────────────────────

export interface GenerateSectionResult {
  filePath: string;
  skillId: string | null;
  technicalSkillIds: string[];
  componentSkillScores: ComponentSkillScore[];
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
  const {
    componentSkillId,
    componentSkillPrompt,
    componentSkillMetadataBlock,
    technicalSkillIds,
    technicalSkillPrompts,
    technicalSkillMetadataBlock,
    componentSkillScores,
  } = isSectionSkillsEnabled()
    ? await discoverAndSelectSkill(
      section,
      projectContext.designKeywords,
      projectContext.rawUserInput,
    )
    : {
      componentSkillId: null,
      componentSkillPrompt: "",
      componentSkillMetadataBlock: "",
      technicalSkillIds: [],
      technicalSkillPrompts: [],
      technicalSkillMetadataBlock: "",
      componentSkillScores: [],
    };

  const skillId = componentSkillId ?? technicalSkillIds[0] ?? null;

  const systemPrompt = buildSystemPrompt({
    section,
    projectGuardrailIds,
    skillPrompts: [componentSkillPrompt, ...technicalSkillPrompts],
    designSystem,
  });

  const userMessage = buildUserMessage({
    projectContext,
    pageContext,
    section,
    componentSkillMetadataBlock,
    technicalSkillMetadataBlock,
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
        componentSkillId,
        technicalSkillIds,
        componentSkillScores,
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
      return { filePath, skillId, technicalSkillIds, componentSkillScores, trace, pendingImages };
    }

    lastError = validationResult.checks.filter((c) => !c.passed).map((c) => c.detail ?? c.name).join("; ");
    if (attempt < MAX_RETRIES) {
      console.warn(`[generateSection] ${componentName} validation failed (attempt ${attempt + 1}), retrying: ${lastError}`);
    }
  }

  throw new Error(`Section validation failed for ${componentName}: ${lastError}`);
}
