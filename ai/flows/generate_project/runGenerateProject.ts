import { existsSync, readdirSync } from "fs";
import { join, relative } from "path";
import { getSiteRoot as projectManagerGetSiteRoot } from "@/lib/projectManager";
import { getSiteRoot, runWithSiteRoot } from "@/ai/tools/system/common";
import { clearFileTracking } from "@/ai/tools";
import { getModelId } from "@/lib/config/models";
import { validateSkillFrontmatter } from "@/ai/shared/skillDiscovery";
import { syncSiteValidationMarkers, readSiteFile, getSkillPromptsRoot } from "./shared/files";
import {
  buildScopedTypecheckStepTrace,
  checkGeneratedTypeScriptFiles,
  formatScopedTypecheckDetail,
  tryTypeScriptCodeFixUntilResolved,
} from "./shared/tsxDiagnostics";
import {
  getLangfuse,
  getLangfuseRunContext,
  runWithLangfuseSpanBranch,
  runWithLangfuseTraceRoot,
  withLangfuseSpan,
} from "@/lib/observability/langfuseTracing";
import { LfSpanGen, LfTrace, lfSpanGenInstallDeps, lfSpanGenPage } from "@/lib/observability/langfuseTraceCatalog";
import { createArtifactLogger, createStepLogger } from "./shared/logging";
import { slugToPagePath } from "./shared/paths";
import { stepAnalyzeProjectRequirement } from "./steps/analyzeProjectRequirement";
import {
  buildEffectiveUserPromptForGeneration,
  stepProjectIntentGuide,
} from "./steps/projectIntentGuide";
import { stepApplyProjectDesignTokens } from "./steps/applyProjectDesignTokens";
import { runArchitectAgent, ARCHITECT_AGENT_STEP } from "./steps/architectAgent";
import { stepExtractUserProvidedContent } from "./steps/extractUserProvidedContent";
import { hasUserProvidedContent } from "./schema/normalizeUserProvidedContent";
import { USER_PROVIDED_CONTENT_PATH } from "@/lib/content/userProvidedContentText";
import { prepareUserProvidedContentForPageAgent } from "./shared/userProvidedContentContext";
import { stepGenerateProjectDesignSystem } from "./steps/generateProjectDesignSystem";
import { stepMatchDesignSystemSkill, type DesignSystemMatchResult } from "./steps/matchDesignSystemSkill";
import { stepInstallDependencies } from "./steps/installDependencies";
import { stepInferDesignIntent, type DesignIntentResult } from "./steps/inferDesignIntent";
import { stepPlanProject } from "./steps/planProject";
import { runPageImplementAgent } from "./steps/pageImplementAgent";
import { discoverAndSelectSkill } from "./steps/heroSkillSelection";
import {
  buildVirtualHeroSectionForSkillSelection,
  shouldOfferHeroSkillForAgentPage,
} from "./shared/agentHeroOpening";
import { stepRepairBuild } from "./steps/repairBuild";
import { stepRunBuild } from "./steps/runBuild";
import { normalizeBlueprint } from "./normalization/blueprintNormalizer";
import {
  appendDependencyInstallFailures,
  appendGeneratedFiles,
  appendInstalledDependencies,
  createInitialResult,
} from "./orchestration/resultAccumulator";
import type {
  BuildStep,
  GenerateProjectResult,
  PageAgentProjectContext,
  PlannedProjectBlueprint,
  ProjectBlueprint,
} from "./types";
import type { ArtifactLogger, StepLogger } from "./shared/logging";
import type { PendingImage } from "../../tools/system/generateImageTool";
import { awaitPendingImages } from "../../tools/system/generateImageTool";
import type { CheckpointResult } from "./shared/checkpoint";
import { resetSectionTscCache } from "./shared/tsxDiagnostics";
import {
  resolveScreenshotIntentMode,
  screenshotGuardrailIdForMode,
} from "./shared/screenshotIntentMode";

function getFileExtension(path: string, fallback = "txt"): string {
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1] ?? fallback;
}

async function persistJsonArtifact(
  artifactLogger: ArtifactLogger,
  step: string,
  name: string,
  value: unknown
): Promise<void> {
  try {
    await artifactLogger.writeJson(step, name, value);
  } catch (error) {
    console.error("[generate_project][artifact]", step, name, error);
  }
}

async function persistTextArtifact(
  artifactLogger: ArtifactLogger,
  step: string,
  name: string,
  content: string,
  extension?: string
): Promise<void> {
  try {
    await artifactLogger.writeText(step, name, content, extension);
  } catch (error) {
    console.error("[generate_project][artifact]", step, name, error);
  }
}

async function persistSiteFileArtifact(
  artifactLogger: ArtifactLogger,
  step: string,
  relativePath: string,
  name: string
): Promise<void> {
  await persistTextArtifact(
    artifactLogger,
    step,
    name,
    readSiteFile(relativePath),
    getFileExtension(relativePath)
  );
}

type ProjectRuntimeContext = PageAgentProjectContext;


function buildProjectRuntimeContext(
  blueprint: PlannedProjectBlueprint
): ProjectRuntimeContext {
  return {
    projectTitle: blueprint.brief.projectTitle,
    projectDescription: blueprint.brief.projectDescription,
    language: blueprint.brief.language ?? "en",
    pages: blueprint.site.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      description: page.description,
      journeyStage: page.journeyStage,
    })),
    designKeywords: blueprint.experience.designIntent.keywords ?? [],
    userProvidedContent: prepareUserProvidedContentForPageAgent(
      blueprint.userProvidedContent
    ),
    rawUserInput: "",
  };
}


function getPageImplementAgentStepName(slug: string): string {
  return `page_implement_agent:${slug}`;
}


function getBuildStepName(attempt: number): string {
  return attempt === 0 ? "run_build" : `run_build:retry_${attempt}`;
}

function getRepairStepName(attempt: number): string {
  return `repair_build:${attempt}`;
}

function getInstallDependenciesStepName(scope: string): string {
  return `install_dependencies:${scope}`;
}

async function autoInstallDependenciesForFiles(params: {
  scope: string;
  files: string[];
  buildOutput?: string;
  artifactLogger: ArtifactLogger;
  result: GenerateProjectResult;
  logger: StepLogger;
}): Promise<void> {
  const { scope, files, buildOutput, artifactLogger, result, logger } = params;
  const stepName = getInstallDependenciesStepName(scope);
  const uniqueFiles = Array.from(new Set(files));

  logger.startStep(stepName);
  try {
    if (uniqueFiles.length === 0) {
      logger.logStep(stepName, "ok", "no generated files to inspect");
      await persistJsonArtifact(artifactLogger, stepName, "output", {
        files: [],
        installed: [],
        failed: [],
      });
      return;
    }

    const installResult = await withLangfuseSpan(
      lfSpanGenInstallDeps(scope),
      () =>
        stepInstallDependencies({
          files: uniqueFiles,
          buildOutput,
        }),
      { metadata: { scope } }
    );
    appendInstalledDependencies(result, installResult.installed);
    appendDependencyInstallFailures(result, installResult.failed);

    const detailParts: string[] = [];
    if (installResult.installed.length > 0) {
      detailParts.push(
        `installed ${installResult.installed.map((item) => item.packageName).join(", ")}`
      );
    }
    if (installResult.failed.length > 0) {
      detailParts.push(
        `failed ${installResult.failed.map((item) => item.packageName).join(", ")}`
      );
    }
    if (installResult.skipped.length > 0) {
      detailParts.push(
        `skipped ${installResult.skipped.map((item) => item.packageName).join(", ")}`
      );
    }
    if (detailParts.length === 0) {
      detailParts.push(installResult.summary);
    }

    logger.logStep(
      stepName,
      installResult.failed.length > 0 ? "error" : "ok",
      detailParts.join("; ")
    );
    await persistJsonArtifact(artifactLogger, stepName, "output", {
      files: uniqueFiles,
      summary: installResult.summary,
      installed: installResult.installed,
      failed: installResult.failed,
      skipped: installResult.skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.logStep(stepName, "error", message);
    await persistJsonArtifact(artifactLogger, stepName, "error", {
      files: uniqueFiles,
      error: message,
    });
  }
}

/**
 * On checkpoint resume we skip `architect_agent` but must still list chrome files
 * that already exist under `components/chrome/**` so dependency install / traces
 * see the full contract (not just `app/layout.tsx`).
 */
function collectExistingArchitectOwnedRelativePaths(): string[] {
  const siteRoot = getSiteRoot();
  const norm = (p: string) => p.replace(/\\/g, "/");
  const paths = new Set<string>(["app/layout.tsx"]);
  const chromeRoot = join(siteRoot, "components", "chrome");
  if (!existsSync(chromeRoot)) {
    return Array.from(paths).sort((a, b) => a.localeCompare(b));
  }
  const walk = (absDir: string): void => {
    for (const ent of readdirSync(absDir, { withFileTypes: true })) {
      const abs = join(absDir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
      } else if (ent.isFile()) {
        paths.add(norm(relative(siteRoot, abs)));
      }
    }
  };
  walk(chromeRoot);
  return Array.from(paths).sort((a, b) => a.localeCompare(b));
}

interface BuildLifecycleResult {
  verificationStatus: GenerateProjectResult["verificationStatus"];
  verificationOutput: string;
}

/**
 * Run the Architect Agent — decides global chrome form and lands it as
 * `app/layout.tsx` + `components/chrome/**`. Page agents subsequently read
 * the layout as a chrome contract and never modify it.
 */
async function runArchitectStep(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  trajectoryCollector?: import("./trajectoryCollector").GenerateTrajectoryCollector;
  onStep?: (step: BuildStep) => void;
  referenceScreenshotDataUrl?: string | null;
  screenshotGuardrailId?: string | null;
}): Promise<{ files: string[] }> {
  const {
    blueprint,
    designSystem,
    artifactLogger,
    logger,
    trajectoryCollector,
    onStep,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
  } = params;
  const onMessage = trajectoryCollector?.createEpisodeCollector(ARCHITECT_AGENT_STEP);

  const outcome = await logger.timed(
    ARCHITECT_AGENT_STEP,
    () =>
      runArchitectAgent({
        blueprint,
        designSystem,
        referenceScreenshotDataUrl: referenceScreenshotDataUrl ?? null,
        screenshotGuardrailId: screenshotGuardrailId ?? null,
        onMessage,
        onStep,
      }),
    (r) => ({
      detail:
        `chrome=${r.chromeForm}` +
        (r.fellBackToMinimal ? " (fallback)" : "") +
        ` · files=${r.files.length}`,
      trace: r.trace,
    })
  );

  await persistJsonArtifact(artifactLogger, ARCHITECT_AGENT_STEP, "output", {
    layoutPath: outcome.layoutPath,
    chromeForm: outcome.chromeForm,
    fellBackToMinimal: outcome.fellBackToMinimal,
    files: outcome.files,
    summary: outcome.summary,
    toolInvocations: outcome.toolCallRecords,
  });
  await persistSiteFileArtifact(artifactLogger, ARCHITECT_AGENT_STEP, outcome.layoutPath, "layout");

  return { files: outcome.files };
}

async function generatePages(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  skipImplementedPages?: Set<string>;
  trajectoryCollector?: import("./trajectoryCollector").GenerateTrajectoryCollector;
  onStep?: (step: BuildStep) => void;
}): Promise<{ files: string[]; pendingImages: PendingImage[] }> {
  const {
    blueprint,
    designSystem,
    runtimeContext,
    artifactLogger,
    logger,
    skipImplementedPages,
    trajectoryCollector,
  } = params;
  const collectedFiles: string[] = [];
  const collectedPendingImages: PendingImage[] = [];

  const pageOutcomes = await Promise.all(
    blueprint.site.pages.map(async (page) => {
      const agentStepName = getPageImplementAgentStepName(page.slug);
      if (skipImplementedPages?.has(page.slug)) {
        const pagePathResume = slugToPagePath(page.slug);
        logger.logStep(agentStepName, "ok", "resumed from checkpoint");
        return { files: [pagePathResume], pendingImages: [] };
      }

      const onMessage = trajectoryCollector?.createEpisodeCollector(agentStepName);
      const outcome = await logger.timed(
        agentStepName,
        async () =>
          runWithLangfuseSpanBranch(
            lfSpanGenPage(page.slug),
            async () => {
              let heroSkillIdInner: string | null = null;
              let heroSkillPromptInner: string | undefined;
              const screenshotBlocksHeroSkill =
                Boolean(runtimeContext.referenceScreenshotDataUrl?.trim()) &&
                runtimeContext.screenshotIntentMode === "replicate_layout";
              if (
                !screenshotBlocksHeroSkill &&
                shouldOfferHeroSkillForAgentPage(page, runtimeContext.rawUserInput)
              ) {
                const virtualHero = buildVirtualHeroSectionForSkillSelection(page);
                const sel = await discoverAndSelectSkill(
                  virtualHero,
                  runtimeContext.designKeywords,
                  runtimeContext.rawUserInput,
                );
                heroSkillIdInner = sel.componentSkillId;
                heroSkillPromptInner = sel.componentSkillPrompt || undefined;
              }
              return runPageImplementAgent({
                page,
                designSystem,
                projectContext: runtimeContext,
                heroSkillPrompt: heroSkillPromptInner,
                heroSkillId: heroSkillIdInner,
                onMessage,
                onStep: params.onStep,
              });
            },
            { metadata: { slug: page.slug, step: agentStepName } }
          ),
        (r) => ({
          detail: r.summary.slice(0, 260),
          trace: r.trace,
          skillId: r.heroSkillId,
        }),
      );

      await persistJsonArtifact(artifactLogger, agentStepName, "output", {
        pagePath: outcome.pagePath,
        summary: outcome.summary,
        toolInvocations: outcome.toolCallRecords,
        pendingImagesCount: outcome.pendingImages.length,
        heroSkillId: outcome.heroSkillId,
      });
      await persistSiteFileArtifact(artifactLogger, agentStepName, outcome.pagePath, "page");

      return { files: [outcome.pagePath], pendingImages: outcome.pendingImages };
    }),
  );

  for (const { files, pendingImages } of pageOutcomes) {
    collectedFiles.push(...files);
    collectedPendingImages.push(...pendingImages);
  }

  return { files: collectedFiles, pendingImages: collectedPendingImages };
}

async function runBuildWithRepair(params: {
  blueprint: PlannedProjectBlueprint;
  artifactLogger: ArtifactLogger;
  result: GenerateProjectResult;
  logger: StepLogger;
}): Promise<BuildLifecycleResult> {
  const { blueprint, artifactLogger, result, logger } = params;
  const maxRepairAttempts = 5;
  /** Extra build retries driven by TS language-service fixes (no repair agent). */
  const maxCfBuildRetriesPerRound = 14;
  let lastBuildOutput = "";
  let sequentialBuildAttempt = 0;

  for (let repairRound = 0; repairRound <= maxRepairAttempts; repairRound += 1) {
    let buildResult: Awaited<ReturnType<typeof stepRunBuild>>;
    let cfRetries = 0;

    cfLoop: while (true) {
      sequentialBuildAttempt += 1;
      const buildStepName = getBuildStepName(sequentialBuildAttempt - 1);
      logger.startStep(buildStepName);
      buildResult = await stepRunBuild();
      lastBuildOutput = buildResult.output;
      logger.logStep(
        buildStepName,
        buildResult.success ? "ok" : "error",
        buildResult.output
      );
      await persistTextArtifact(
        artifactLogger,
        buildStepName,
        "build-output",
        buildResult.output,
        "log"
      );

      if (buildResult.success) {
        return {
          verificationStatus: "passed",
          verificationOutput: buildResult.output,
        };
      }

      const cfResult = await tryTypeScriptCodeFixUntilResolved(result.generatedFiles, 25);
      if (cfResult.touchedFiles.length === 0) {
        break cfLoop;
      }
      cfRetries += 1;
      if (cfRetries > maxCfBuildRetriesPerRound) {
        break cfLoop;
      }

      appendGeneratedFiles(result, cfResult.touchedFiles);
      await autoInstallDependenciesForFiles({
        scope: `ts_code_fix_r${repairRound}_c${cfRetries}`,
        files: cfResult.touchedFiles,
        buildOutput: buildResult.output,
        artifactLogger,
        result,
        logger,
      });
    }

    if (repairRound === maxRepairAttempts) {
      break;
    }

    const repairResult = await logger.timed(
      getRepairStepName(repairRound + 1),
      () =>
        stepRepairBuild({
          blueprint,
          buildOutput: buildResult.output,
          generatedFiles: result.generatedFiles,
        }),
      (value) => (value.success ? value.touchedFiles.join(", ") || "repair applied" : value.output)
    );
    await persistJsonArtifact(artifactLogger, getRepairStepName(repairRound + 1), "output", repairResult);

    if (!repairResult.success) {
      return {
        verificationStatus: "failed",
        verificationOutput: buildResult.output,
      };
    }

    appendGeneratedFiles(result, repairResult.touchedFiles);
    for (const touchedFile of repairResult.touchedFiles) {
      await persistSiteFileArtifact(
        artifactLogger,
        getRepairStepName(repairRound + 1),
        touchedFile,
        `touched-${touchedFile.replace(/[\\/]+/g, "_")}`
      );
    }
    await autoInstallDependenciesForFiles({
      scope: `repair_${repairRound + 1}`,
      files: repairResult.touchedFiles,
      buildOutput: buildResult.output,
      artifactLogger,
      result,
      logger,
    });
  }

  return {
    verificationStatus: "failed",
    verificationOutput: lastBuildOutput,
  };
}

export interface RunGenerateProjectOptions {
  /** Required — drives sites/<projectId>/ scoping via runWithSiteRoot. */
  projectId: string;
  styleGuide?: string;
  enableSkills?: boolean;
  useDatabasePrompts?: boolean;
  checkpoint?: CheckpointResult;
  /** When true, run `project_intent_guide` before analyze; may defer generation for user dialogue. */
  enableIntentGuide?: boolean;
  /** Maps to Langfuse `userId` when a trace root is opened for this run. */
  langfuseUserId?: string;
  /**
   * Langfuse `sessionId` when this flow opens its own trace (no parent trace).
   * Routes should pass the same id as HTTP-level {@link resolveLangfuseSessionId}.
   */
  langfuseSessionId?: string;
  /** Appended to default Langfuse trace tags (`flow:generate_project`). */
  langfuseTraceTags?: string[];
  /** Shallow-merged into default trace metadata (`projectId` is always set). */
  langfuseTraceMetadata?: Record<string, unknown>;
  /** When set, replaces the default trace `input` snapshot for the root observation. */
  langfuseTraceInput?: unknown;
  /** When set, passed into `project_intent_guide` vision (direct /api/ai or worker). */
  userReferenceImageBase64?: string | null;
}

async function ensureLangfuseGenerateTrace<T>(
  options: RunGenerateProjectOptions,
  userInput: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!getLangfuse() || getLangfuseRunContext()) {
    return fn();
  }
  const extraTags = options.langfuseTraceTags?.filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );
  const tags =
    extraTags && extraTags.length > 0
      ? ["flow:generate_project", ...extraTags]
      : ["flow:generate_project"];
  const metadata: Record<string, unknown> = {
    ...(options.langfuseTraceMetadata ?? {}),
    projectId: options.projectId,
  };
  const input =
    options.langfuseTraceInput !== undefined
      ? options.langfuseTraceInput
      : {
          userInput,
          enableIntentGuide: options.enableIntentGuide,
          enableSkills: options.enableSkills,
        };

  return runWithLangfuseTraceRoot(
    {
      name: LfTrace.generateProject,
      userId: options.langfuseUserId,
      sessionId: options.langfuseSessionId ?? options.projectId,
      tags,
      metadata,
      input,
    },
    fn
  );
}

/**
 * Public entry point. Binds the project's `sites/<projectId>/` directory as
 * the active site root for the entire async chain via AsyncLocalStorage so
 * concurrent runs cannot corrupt each other's working directory or leak into
 * `sites/template/`.
 */
export async function runGenerateProject(
  userInput: string,
  onStep?: (step: BuildStep) => void,
  options?: Partial<RunGenerateProjectOptions>
): Promise<GenerateProjectResult> {
  if (!options?.projectId || typeof options.projectId !== "string") {
    throw new Error(
      "runGenerateProject: `options.projectId` is required. " +
        "Call initProjectDir(db, projectId) to scaffold sites/<projectId>/ before invoking the flow."
    );
  }
  const siteRoot = projectManagerGetSiteRoot(options.projectId);
  return runWithSiteRoot(siteRoot, () =>
    ensureLangfuseGenerateTrace(options as RunGenerateProjectOptions, userInput, () =>
      runGenerateProjectInner(userInput, onStep, options as RunGenerateProjectOptions)
    )
  );
}

async function runGenerateProjectInner(
  userInput: string,
  onStep: ((step: BuildStep) => void) | undefined,
  options: RunGenerateProjectOptions
): Promise<GenerateProjectResult> {
  // Reset module-level read/write trackers so a previous run's bookkeeping
  // can't leak into this one (e.g. read_lints picking up stale paths).
  clearFileTracking();
  const flowStart = Date.now();
  const logger = createStepLogger({ onStep, prefix: "generate_project" });
  const artifactLogger = createArtifactLogger("generate_project");
  const result = createInitialResult(logger);
  result.logDirectory = artifactLogger.runDirRelative;

  // Trajectory collector — records conversation history from agent steps
  const { GenerateTrajectoryCollector } = await import("./trajectoryCollector");
  const trajectoryCollector = new GenerateTrajectoryCollector(
    options.projectId,
    userInput,
    getModelId()
  );

  const cp = options.checkpoint;

  const runPipeline = async (): Promise<void> => {
  try {
    // Always validate skill files (skills are enabled by default)
    {
      const skillFrontmatterErrors = validateSkillFrontmatter(getSkillPromptsRoot());
      if (skillFrontmatterErrors.length > 0) {
        const detail = skillFrontmatterErrors.map((e) => `${e.fileName}: ${e.message}`).join(" | ");
        logger.logStep("validate_skill_prompts", "error", detail);
        throw new Error(`Invalid skill prompt frontmatter: ${detail}`);
      }
      logger.logStep("validate_skill_prompts", "ok", "all skill files validated");
    }

    await persistJsonArtifact(artifactLogger, "run", "input", {
      userInput,
      enableIntentGuide: options.enableIntentGuide === true,
      checkpoint: cp ? { hasCheckpoint: cp.hasCheckpoint, summary: cp.summary } : null,
    });

    if (cp?.hasCheckpoint) {
      logger.logStep("checkpoint_resume", "ok", cp.summary);
    }

    let effectiveUserInput = userInput;

    if (options.enableIntentGuide !== false && !cp?.skipAnalyze) {
      logger.startStep("project_intent_guide");
      const intentResult = await withLangfuseSpan(LfSpanGen.intentGuide, () =>
        stepProjectIntentGuide(userInput, {
          imageBase64: options.userReferenceImageBase64 ?? null,
        })
      );
      logger.logStep(
        "project_intent_guide",
        "ok",
        intentResult.outcome === "guide_user"
          ? `deferred:${intentResult.phase}`
          : `continue:${intentResult.phase}`,
        undefined,
        intentResult.trace
      );
      await persistJsonArtifact(artifactLogger, "project_intent_guide", "output", {
        outcome: intentResult.outcome,
        phase: intentResult.phase,
        assistantMessage: intentResult.assistantMessage,
        suggestedReplies: intentResult.suggestedReplies,
        choiceOptions: intentResult.choiceOptions,
        buildPromptAppendix: intentResult.buildPromptAppendix,
      });

      if (intentResult.outcome === "guide_user") {
        result.intentGuideDeferred = true;
        result.intentGuide = intentResult;
        result.error = "INTENT_GUIDE_DEFERRED";
        result.success = false;
        result.totalDuration = Date.now() - flowStart;
        await persistJsonArtifact(artifactLogger, "run", "result", result);
        resetSectionTscCache();
        return;
      }

      effectiveUserInput = buildEffectiveUserPromptForGeneration(
        userInput,
        intentResult.buildPromptAppendix
      );
    }

    // ── Step: analyze_project_requirement ─────────────────────────────────
    const referenceScreenshot = options.userReferenceImageBase64?.trim() || null;
    const screenshotIntentMode = resolveScreenshotIntentMode(
      effectiveUserInput,
      Boolean(referenceScreenshot)
    );
    const screenshotGuardrailId = screenshotGuardrailIdForMode(screenshotIntentMode);

    let rawBlueprint!: ProjectBlueprint;
    let inferredDesignIntent: DesignIntentResult | null = null;

    if (cp?.skipAnalyze && cp.cachedBlueprint) {
      rawBlueprint = cp.cachedBlueprint;
      logger.logStep("analyze_project_requirement", "ok", "resumed from checkpoint");

      if (rawBlueprint.experience?.designIntent?.keywords?.length) {
        logger.logStep("infer_design_intent", "ok", "resumed from checkpoint");
      } else {
        inferredDesignIntent = await logger.timed(
          "infer_design_intent",
          () =>
            stepInferDesignIntent(effectiveUserInput, {
              referenceImageBase64: referenceScreenshot,
              screenshotGuardrailId,
            }),
          (r) => ({ detail: r.text.slice(0, 80), trace: r.trace })
        );
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntent.text, "md");
      }
    } else {
      await withLangfuseSpan(LfSpanGen.analyzeBlueprintParallel, async () => {
        logger.startStep("analyze_project_requirement");
        logger.startStep("infer_design_intent");
        const [analyzeResult, inferResult] = await Promise.all([
          stepAnalyzeProjectRequirement(
            effectiveUserInput,
            (name, args, result) => {
              onStep?.({
                step: `tool_call:${name}`,
                status: "ok",
                detail: JSON.stringify({ tool: name, args, result: result.slice(0, 500) }),
                timestamp: Date.now(),
                duration: 0,
              });
            },
            { referenceImageBase64: referenceScreenshot, screenshotGuardrailId }
          ),
          stepInferDesignIntent(effectiveUserInput, {
            referenceImageBase64: referenceScreenshot,
            screenshotGuardrailId,
          }),
        ]);
        logger.logStep(
          "analyze_project_requirement",
          "ok",
          `${analyzeResult.blueprint.brief.roles.length} roles, ${analyzeResult.blueprint.site.pages.length} pages planned`,
          undefined,
          analyzeResult.trace
        );
        logger.logStep(
          "infer_design_intent",
          "ok",
          inferResult.text.slice(0, 80),
          undefined,
          inferResult.trace
        );
        rawBlueprint = analyzeResult.blueprint;
        inferredDesignIntent = inferResult;
        await persistJsonArtifact(artifactLogger, "analyze_project_requirement", "output", rawBlueprint);
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntent.text, "md");
      });
    }

    if (!rawBlueprint.experience) {
      rawBlueprint.experience = {
        designIntent: {
          mood: ["clean", "trustworthy", "focused"],
          colorDirection: "Neutral base with one clear accent direction.",
          style: "Modern, content-first, conversion-oriented.",
          keywords: ["clean", "professional", "focused", "confident", "modern"],
        },
      };
    }

    // ── Organize user query (after analyze, before plan) ──
    if (!cp?.skipAnalyze) {
      rawBlueprint = { ...rawBlueprint, userProvidedContent: undefined };

      const extractResult = await logger.timed(
        "extract_user_provided_content",
        () =>
          stepExtractUserProvidedContent({
            userInput: effectiveUserInput,
            referenceImageBase64: referenceScreenshot,
          }),
        (r) => ({
          detail: r.content
            ? `${r.content.images?.length ?? 0} images, address=${Boolean(r.content.business?.address)}`
            : "none",
          trace: r.trace,
        })
      );
      if (extractResult.content && hasUserProvidedContent(extractResult.content)) {
        rawBlueprint = {
          ...rawBlueprint,
          userProvidedContent: extractResult.content,
        };
        await persistJsonArtifact(
          artifactLogger,
          "extract_user_provided_content",
          "output",
          extractResult.content
        );
      }
    }

    const normalizedBlueprint = normalizeBlueprint(rawBlueprint);

    // ── Steps: plan_project + match/generate design system ──
    let blueprint!: PlannedProjectBlueprint;
    let designSystem!: string;

    if (cp?.skipPlanAndDesign && cp.cachedBlueprint && cp.cachedDesignSystem) {
      blueprint = cp.cachedBlueprint;
      designSystem = cp.cachedDesignSystem;
      logger.logStep("plan_project", "ok", "resumed from checkpoint");
      logger.logStep("generate_project_design_system", "ok", "resumed from checkpoint");
    } else {
      await withLangfuseSpan(LfSpanGen.planAndDesignSystem, async () => {
        logger.startStep("plan_project");
        logger.startStep("match_design_system_skill");

        // Build a fallback markdown text from blueprint's designIntent if inferDesignIntent returned empty
        const designIntentForSystem = inferredDesignIntent?.text || (() => {
          const di = rawBlueprint.experience?.designIntent;
          if (!di) return "";
          return `## Design Intent\n- Mood: ${di.mood.join(", ")}\n- Color Direction: ${di.colorDirection}\n- Style: ${di.style}\n- Keywords: ${di.keywords.join(", ")}`;
        })();

        // Phase 1: plan_project + (optionally) skill matching run in parallel
        const skillMatchingEnabled = options.enableSkills !== false;

        const planPromise = stepPlanProject(normalizedBlueprint).then((out) => {
          logger.logStep("plan_project", "ok", "page-level blueprints prepared", undefined, out.trace);
          return out;
        });

        const matchPromise: Promise<DesignSystemMatchResult> = skillMatchingEnabled
          ? stepMatchDesignSystemSkill({
            userInput: effectiveUserInput,
          }).then((result) => {
            logger.logStep(
              "match_design_system_skill",
              "ok",
              result.matched
                ? `matched built-in skill: ${result.skillId} — ${result.reason}`
                : `no match — ${result.reason}`,
              result.matched ? result.skillId : undefined
            );
            // Attach trace so the topology detail drawer shows LLM call, input/output
            if (result.trace && Object.keys(result.trace).length > 0) {
              logger.attachTrace("match_design_system_skill", result.trace);
            }
            return result;
            })
          : Promise.resolve<DesignSystemMatchResult>({
            matched: false,
            skillId: null,
            reason: "skill matching disabled by user",
            trace: {},
          }).then((result) => {
            logger.logStep("match_design_system_skill", "ok", "skipped — disabled by user");
            return result;
          });

        const [planOutcome, matchResult] = await Promise.all([planPromise, matchPromise]);

        blueprint = planOutcome.blueprint;

        await persistJsonArtifact(artifactLogger, "match_design_system_skill", "output", {
          matched: matchResult.matched,
          skillId: matchResult.skillId,
          reason: matchResult.reason,
        });

        // Phase 2: use matched skill or fall back to LLM generation
        if (matchResult.matched && matchResult.designSystem) {
          designSystem = matchResult.designSystem;
          logger.logStep(
            "generate_project_design_system",
            "ok",
            `using built-in skill: ${matchResult.skillId}`
          );
        } else {
          logger.startStep("generate_project_design_system");
          const dsOutcome = await stepGenerateProjectDesignSystem(
            designIntentForSystem,
            options.styleGuide
          );
          designSystem = dsOutcome.designSystem;
          logger.logStep(
            "generate_project_design_system",
            "ok",
            "design-system.md written",
            undefined,
            dsOutcome.trace
          );
        }

        // Merge infer_design_intent technical keywords after style matching for hero skill routing.
        if (inferredDesignIntent?.technicalKeywords?.length) {
          const existing = blueprint.experience.designIntent.keywords;
          const merged = [...new Set([...existing, ...inferredDesignIntent.technicalKeywords])];
          blueprint.experience.designIntent.keywords = merged;
        }

        // Keep plan_project artifact focused on fields that are actually produced by
        // this step and consumed downstream. Full blueprint is still persisted in
        // final run/result artifacts.
        await persistJsonArtifact(artifactLogger, "plan_project", "output", {
          site: {
            pages: blueprint.site.pages.map((page) => ({
              slug: page.slug,
              pageDesignPlan: page.pageDesignPlan,
              sections: page.sections.map((section) => ({
                type: section.type,
                fileName: section.fileName,
                intent: section.intent,
                contentHints: section.contentHints,
              })),
            })),
          },
        });
        await persistTextArtifact(
          artifactLogger,
          "generate_project_design_system",
          "design-system",
          designSystem,
          "md"
        );
      });
    }

    result.blueprint = blueprint;
    const runtimeContext = buildProjectRuntimeContext(blueprint);
    runtimeContext.rawUserInput = effectiveUserInput;
    runtimeContext.screenshotIntentMode = screenshotIntentMode;
    if (referenceScreenshot) {
      runtimeContext.referenceScreenshotDataUrl = referenceScreenshot;
    }
    appendGeneratedFiles(result, ["design-system.md", "project-plan.json"]);
    if (blueprint.userProvidedContent && hasUserProvidedContent(blueprint.userProvidedContent)) {
      appendGeneratedFiles(result, [USER_PROVIDED_CONTENT_PATH]);
    }

    // ── Step: apply_project_design_tokens, then UI generation (sequential) ──
    // Must not run architects / page agents in parallel with token application:
    // they have write_file and could overwrite app/globals.css after the LLM
    // writes it (or read a stale template snapshot before tokens land).
    if (cp?.skipDesignTokens) {
      logger.logStep("apply_project_design_tokens", "ok", "resumed from checkpoint");
    } else {
      const tokenResult = await withLangfuseSpan(LfSpanGen.applyDesignTokens, () =>
        logger.timed(
          "apply_project_design_tokens",
          () =>
            stepApplyProjectDesignTokens(designSystem, {
              onProgress: (msg) => {
                onStep?.({
                  step: "apply_project_design_tokens",
                  status: "active",
                  detail: msg,
                  timestamp: Date.now(),
                  duration: 0,
                });
              },
            }),
          (r) => ({ detail: r.files.join(", "), trace: r.trace })
        )
      );
      const tokenFiles = tokenResult.files;
      await persistJsonArtifact(artifactLogger, "apply_project_design_tokens", "output", {
        files: tokenFiles,
      });
      for (const tokenFile of tokenFiles) {
        await persistSiteFileArtifact(
          artifactLogger,
          "apply_project_design_tokens",
          tokenFile,
          `site-file-${tokenFile.replace(/[\\/]+/g, "_")}`
        );
      }
      appendGeneratedFiles(result, tokenFiles);
    }

    // ── Architect before page agents (sequential) ─────────────────────────────
    // Globals are already finalized (`apply_project_design_tokens` finished above).
    // Run architect_agent to completion first so each page_implement_agent reads an
    // up-to-date `app/layout.tsx` snapshot and finalized `components/chrome/**`,
    // avoiding duplicate in-page chrome from stale/minimal interim layouts.
    if (!cp?.skipArchitect) {
      const architectResult = await withLangfuseSpan(LfSpanGen.architectAgent, () =>
        runArchitectStep({
          blueprint,
          designSystem,
          artifactLogger,
          logger,
          trajectoryCollector,
          onStep,
          referenceScreenshotDataUrl: referenceScreenshot,
          screenshotGuardrailId,
        })
      );
      appendGeneratedFiles(result, architectResult.files);
    } else {
      appendGeneratedFiles(result, collectExistingArchitectOwnedRelativePaths());
    }

    const pageOutcome = await withLangfuseSpan(LfSpanGen.implementPages, () =>
      generatePages({
        blueprint,
        designSystem,
        runtimeContext,
        artifactLogger,
        logger,
        skipImplementedPages: cp?.implementedPages,
        trajectoryCollector,
        onStep,
      })
    );
    appendGeneratedFiles(result, pageOutcome.files);
    const allPendingImages = pageOutcome.pendingImages;
    // Await all background image generation before build — images must be on
    // disk for Next.js to bundle them. This runs in parallel with dependency
    // installation since they don't conflict.
    const [imageStats] = await Promise.all([
      awaitPendingImages(allPendingImages),
      runWithLangfuseSpanBranch(LfSpanGen.installDependenciesAfterImplement, () =>
        autoInstallDependenciesForFiles({
          scope: "generated",
          files: result.generatedFiles,
          artifactLogger,
          result,
          logger,
        })
      ),
    ]);

    if (imageStats.total > 0) {
      const imageDetails = allPendingImages.map((img) =>
        `${img.filename}: ${(img.durationMs / 1000).toFixed(1)}s`
      ).join(", ");
      logger.logStep(
        "await_images",
        imageStats.failed > 0 ? "error" : "ok",
        `${imageStats.settled}/${imageStats.total} images generated (${imageDetails})${imageStats.failed > 0 ? `, ${imageStats.failed} failed` : ""}`
      );

      // Persist per-image details (prompt, duration, path) for trace inspection
      await persistJsonArtifact(artifactLogger, "await_images", "output", {
        images: allPendingImages.map((img) => ({
          filename: img.filename,
          path: img.publicPath,
          prompt: img.prompt,
          size: img.size,
          durationMs: img.durationMs,
        })),
        summary: imageStats,
      });

      // Add generated image files to the result so they get uploaded to
      // Supabase Storage and are available after server restarts.
      const imagePaths = allPendingImages
        .filter((img) => img.success)
        .map((img) => `public/images/${img.filename}.png`)
        .filter((p) => !result.generatedFiles.includes(p));
      appendGeneratedFiles(result, imagePaths);
    }

    // ── Optional pre-build typecheck (generated .tsx only) ───────────────────
    // In-process `checkTsxFile` per file (same engine as section validation), not
    // `npx tsc` on the whole site. On errors, `stepRepairBuild` uses edit_file
    // (small patches), same style as the modify flow's patch tools.
    // Default ON — opt-out via DISABLE_PREBUILD_TSC=1 (or DISABLE_SECTION_TSC=1
    // for the lower-level checker that this step calls into).
    const enablePrebuildTypecheck = process.env.DISABLE_PREBUILD_TSC !== "1";
    if (enablePrebuildTypecheck) {
      const tscStepName = "typecheck_generated";
      logger.startStep(tscStepName);
      const scoped = await checkGeneratedTypeScriptFiles(result.generatedFiles);
      if (scoped.skipped === "disabled") {
        logger.logStep(
          tscStepName,
          "ok",
          formatScopedTypecheckDetail(scoped),
          undefined,
          buildScopedTypecheckStepTrace(scoped)
        );
        await persistJsonArtifact(artifactLogger, tscStepName, "output", { scoped: "disabled" });
      } else if (scoped.skipped === "no_tsx_files") {
        logger.logStep(
          tscStepName,
          "ok",
          formatScopedTypecheckDetail(scoped),
          undefined,
          buildScopedTypecheckStepTrace(scoped)
        );
        await persistJsonArtifact(artifactLogger, tscStepName, "output", { scoped: "no_tsx_files" });
      } else if (scoped.passed) {
        logger.logStep(
          tscStepName,
          "ok",
          formatScopedTypecheckDetail(scoped),
          undefined,
          buildScopedTypecheckStepTrace(scoped)
        );
        await persistJsonArtifact(artifactLogger, tscStepName, "output", {
          fileCount: scoped.fileCount,
          checkedFiles: scoped.checkedFiles,
          errorCount: 0,
          warningCount: scoped.warningCount,
          issues: scoped.issues,
        });
      } else {
        const errorCount = scoped.errorCount;
        console.warn(
          `[typecheck] scoped: ${errorCount} error(s) in ${scoped.fileCount} file(s), attempting repair...`
        );
        const repairResult = await withLangfuseSpan(
          LfSpanGen.typescriptRepair,
          () =>
            stepRepairBuild({
              blueprint,
              buildOutput: scoped.tscStyleLog,
              generatedFiles: result.generatedFiles,
            })
        );
        if (repairResult.success && repairResult.touchedFiles.length > 0) {
          appendGeneratedFiles(result, repairResult.touchedFiles);
        }

        const scopedAfter = await checkGeneratedTypeScriptFiles(result.generatedFiles);

        if (scopedAfter.passed || scopedAfter.errorCount === 0) {
          logger.logStep(
            tscStepName,
            "ok",
            formatScopedTypecheckDetail(
              scopedAfter,
              repairResult.success
                ? `Repair: patched file(s) — ${repairResult.touchedFiles.join(", ") || "(language-service fixes only)"}`
                : undefined
            ),
            undefined,
            buildScopedTypecheckStepTrace(scopedAfter, {
              repairTouched: repairResult.touchedFiles,
              repairSuccess: true,
            })
          );
        } else {
          logger.logStep(
            tscStepName,
            "error",
            formatScopedTypecheckDetail(
              scopedAfter,
              repairResult.success
                ? `Partial repair (${repairResult.touchedFiles.join(", ") || "no paths"}); diagnostics remain.`
                : "Repair: step_repair_build did not apply edits; see trace / `.open-ox/logs/.../typecheck_generated/`."
            ),
            undefined,
            buildScopedTypecheckStepTrace(scopedAfter, {
              repairSuccess: false,
              repairTouched: repairResult.touchedFiles,
            })
          );
        }

        await persistJsonArtifact(artifactLogger, tscStepName, "output", {
          fileCount: scopedAfter.fileCount,
          checkedFiles: scopedAfter.checkedFiles,
          errorCount: scopedAfter.errorCount,
          errors: scopedAfter.tscStyleLog.slice(0, 4000),
          issues: scopedAfter.issues,
          repairResult: {
            success: repairResult.success,
            touchedFiles: repairResult.touchedFiles,
          },
          scopedAfterPassed: scopedAfter.passed,
        });
      }
    } else {
      logger.logStep(
        "typecheck_generated",
        "ok",
        "skipped (DISABLE_PREBUILD_TSC=1)",
        undefined,
        { output: { scopedTypecheck: { skipped: "disable_prebuild_tsc" } } }
      );
    }

    const buildLifecycle = await withLangfuseSpan(LfSpanGen.buildVerifyAndRepair, () =>
      runBuildWithRepair({ blueprint, artifactLogger, result, logger })
    );
    result.verificationStatus = buildLifecycle.verificationStatus;
    result.verificationOutput = buildLifecycle.verificationOutput;

    if (buildLifecycle.verificationStatus === "failed") {
      result.unvalidatedFiles = await logger.timed(
        "mark_unvalidated_files",
        () => syncSiteValidationMarkers(result.generatedFiles, "failed", buildLifecycle.verificationOutput),
        (files) => `${files.length} files marked`
      );
    } else {
      await logger.timed(
        "clear_validation_markers",
        () => syncSiteValidationMarkers(result.generatedFiles, "passed"),
        (files) => (files.length > 0 ? `${files.length} files cleaned` : "no markers present")
      );
      result.unvalidatedFiles = [];
    }

    await persistJsonArtifact(artifactLogger, "run", "verification", {
      status: result.verificationStatus,
      output: result.verificationOutput,
      unvalidatedFiles: result.unvalidatedFiles,
      installedDependencies: result.installedDependencies,
      dependencyInstallFailures: result.dependencyInstallFailures,
    });
    result.success = true;

    // Save trajectory
    trajectoryCollector.save(
      result.generatedFiles,
      result.verificationStatus === "passed",
      result.steps?.length ?? 0
    ).catch(err => console.warn("[trajectory] Generate trajectory save failed:", err));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.success = false;
    await persistJsonArtifact(artifactLogger, "run", "error", {
      error: result.error,
    });
  }
  };

  if (getLangfuse() && getLangfuseRunContext()) {
    await withLangfuseSpan(LfSpanGen.fullPipeline, runPipeline);
  } else {
    await runPipeline();
  }

  result.totalDuration = Date.now() - flowStart;
  try {
    await persistJsonArtifact(artifactLogger, "run", "result", result);
  } finally {
    resetSectionTscCache();
  }
  return result;
}
