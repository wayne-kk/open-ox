import { formatSiteFile, writeSiteFile } from "../../shared/files";
import { callLLMWithTools, extractContent } from "../../shared/llm";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { getSystemToolDefinitions } from "../../../../tools/systemToolCatalog";
import { createImageExecutor } from "../../../../tools/system/generateImageTool";
import type { PendingImage } from "../../../../tools/system/generateImageTool";
import type { TsxIssue } from "../../shared/tsxDiagnostics";
import type { LayoutMode, PlannedSectionSpec, StepTrace } from "../../types";
import { discoverAndSelectSkill } from "./sectionSkillSelection";
import { buildSystemPrompt, buildUserMessage } from "./sectionPrompts";
import { buildRetryHint, getSectionMaxRetries, validateSection } from "./sectionValidation";
import type {
  ComponentSkillScore,
  GenerateSectionPageContext,
  GenerateSectionProjectContext,
} from "./types";

export type { ComponentSkillScore, GenerateSectionPageContext, GenerateSectionProjectContext };

export interface GenerateSectionParams {
  designSystem: string;
  projectContext: GenerateSectionProjectContext;
  section: PlannedSectionSpec;
  outputFileRelative: string;
  pageContext?: GenerateSectionPageContext;
  sectionDesignBrief: string;
  /** When `"whole-page"`, use `section.wholePage` instead of `section.default` as the base prompt. */
  layoutMode?: LayoutMode;
  /** Optional: callback to collect conversation messages for trajectory logging */
  onMessage?: (msg: import("@/ai/shared/llm/types").ChatMessage) => void;
}

export interface GenerateSectionResult {
  filePath: string;
  /**
   * Selected **component** skill id, or null. Technical-only skills are not promoted here; see `technicalSkillIds` and `trace.input`.
   */
  skillId: string | null;
  technicalSkillIds: string[];
  componentSkillScores: ComponentSkillScore[];
  trace: StepTrace;
  pendingImages: PendingImage[];
}

export async function stepGenerateSection(params: GenerateSectionParams): Promise<GenerateSectionResult> {
  const {
    designSystem,
    projectContext,
    section,
    outputFileRelative,
    pageContext,
    sectionDesignBrief,
    layoutMode,
  } = params;
  const {
    componentSkillId,
    componentSkillPrompt,
    componentSkillMetadataBlock,
    technicalSkillIds,
    technicalSkillPrompts,
    technicalSkillMetadataBlock,
    componentSkillScores,
  } = await discoverAndSelectSkill(
    section,
    projectContext.designKeywords,
    projectContext.rawUserInput,
  );

  const skillId = componentSkillId;

  const useDescribePageBrief = !componentSkillId;

  const systemPrompt = buildSystemPrompt({
    section,
    skillPrompts: [componentSkillPrompt, ...technicalSkillPrompts],
    designSystem,
    layoutMode,
  });

  const userMessage = buildUserMessage({
    projectContext,
    pageContext,
    section,
    componentSkillMetadataBlock,
    technicalSkillMetadataBlock,
    sectionDesignBrief,
    useDescribePageBrief,
    layoutMode,
  });

  const componentName = section.fileName.replace(/\.tsx$/, "");
  const filePath = outputFileRelative;
  const sectionModel = getModelForStep("generate_section");
  const sectionThinkingLevel = getThinkingLevelForStep("generate_section");
  const maxExtraAttempts = getSectionMaxRetries();
  let lastError = "";
  let lastValidationResult: NonNullable<StepTrace["validationResult"]> | null = null;
  let lastTscIssues: TsxIssue[] = [];

  const imageTools = getSystemToolDefinitions(["generate_image"]);
  const { executor: imageExecutor, pendingImages } = createImageExecutor(componentName);

  for (let attempt = 0; attempt <= maxExtraAttempts; attempt++) {
    const retryHint = attempt > 0 ? buildRetryHint(componentName, lastTscIssues, lastValidationResult) : "";

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

    const { result: validationResult, tscIssues } = await validateSection(tsx, componentName, filePath);

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
        useDescribePageBrief,
        pageContext: pageContext ? { slug: pageContext.slug, title: pageContext.title } : null,
        layoutMode: layoutMode ?? "split-sections",
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

    lastValidationResult = validationResult;
    lastTscIssues = tscIssues;
    lastError = validationResult.checks
      .filter((c) => !c.passed)
      .map((c) => c.detail ?? c.name)
      .join("; ");
    if (attempt < maxExtraAttempts) {
      const summary =
        lastTscIssues.length > 0
          ? `${lastTscIssues.filter((i) => i.category === "error").length} tsc error(s)`
          : lastError;
      console.warn(
        `[generateSection] ${componentName} validation failed (attempt ${attempt + 1}), retrying: ${summary}`,
      );
    }
  }

  throw new Error(`Section validation failed for ${componentName}: ${lastError}`);
}
