import { existsSync, readdirSync } from "fs";
import { join, relative } from "path";
import { getSiteRoot as projectManagerGetSiteRoot } from "@/lib/projectManager";
import type { SelectedDesignSystemSkill } from "@/lib/generation/selectedDesignSystemSkill";
import { getSiteRoot, runWithSiteRoot } from "@/ai/tools/system/common";
import { clearFileTracking } from "@/ai/tools";
import { validateSkillFrontmatter } from "@/ai/shared/skillDiscovery";
import { validateDesignSystemSkillCatalog } from "./designSystem/catalog";
import { resolveDesignSystem } from "./designSystem/productionResolver";
import type { DesignSystemMatchOutcome } from "./designSystem/types";
import { syncSiteValidationMarkers, readSiteFile, getSkillPromptsRoot, writeSiteFile } from "./shared/files";
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
import {
  ARCHITECT_SCAFFOLD_AGENT_STEP,
  runArchitectScaffoldAgent,
} from "./steps/architectScaffoldAgent";
import {
  runChromeOptimizeAgent,
  CHROME_OPTIMIZE_AGENT_STEP,
  type PageImplementSummary,
} from "./steps/chromeOptimizeAgent";
import {
  resolveChromeForm,
} from "./shared/chromeForm";
import { writeSharedContractStubs } from "./shared/writeSharedContractStubs";
import { stepInstallDependencies } from "./steps/installDependencies";
import { stepInferDesignIntent, type DesignIntentResult } from "./steps/inferDesignIntent";
import { stepPlanProject } from "./steps/planProject";
import { runPageImplementAgent } from "./steps/pageImplementAgent";
import { stepRepairBuild } from "./steps/repairBuild";
import { stepRunBuild } from "./steps/runBuild";
import { normalizeBlueprint } from "./normalization/blueprintNormalizer";
import { emptyProjectExperience } from "./schema/normalizeBlueprint";
import { applyDesignKeywordsBeforePlan } from "./shared/applyDesignKeywords";
import { hasUserProvidedContent } from "./schema/normalizeUserProvidedContent";
import { USER_PROVIDED_CONTENT_PATH } from "@/lib/content/userProvidedContentText";
import { prepareUserProvidedContentForPageAgent } from "./shared/userProvidedContentContext";
import {
  appendDependencyInstallFailures,
  appendGeneratedFiles,
  appendInstalledDependencies,
  createInitialResult,
} from "./orchestration/resultAccumulator";
import {
  buildVerifierRefeedBuildOutput,
  describeVerifierVerdict,
  mergeRepairTouchedFiles,
  repairVerifierNeedsRefeed,
} from "./orchestration/verifierRepairRefeed";
import {
  formatResearchBriefForParent,
  runResearchSubagent,
} from "@/ai/shared/subagent";
import { listReferenceSiteCandidateUrls } from "@/lib/reference/referenceSiteUrls";
import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { getModelForStep } from "@/lib/config/models";
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
import { prepareReplicaSiteLayout } from "./shared/applyMinimalReplicaRootLayout";
import {
  isScreenshotReplicaPipelineEnabled,
  resolvePageGenerationScreenshotMode,
  shouldBlockSkillsForScreenshotReplicate,
  shouldUseScreenshotReplicaPipeline,
} from "./shared/screenshotReplicaPipeline";
import {
  stepAnalyzeScreenshotLayout,
  ANALYZE_SCREENSHOT_LAYOUT_STEP,
} from "./steps/analyzeScreenshotLayout";
import { generatePagesViaReplica } from "./generatePagesViaReplica";
import {
  mergePageSpecSectionsIntoBlueprint,
  pageSpecSectionsToPlannedSections,
  tryLoadPageSpecFromSite,
  type PageSpec,
} from "./schema/pageSpec";

const PAGE_IMPLEMENT_CONCURRENCY = 3;

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

function formatDesignSystemMatchDetail(
  outcome: DesignSystemMatchOutcome,
): string {
  if (outcome.source === "skill") {
    const prefix =
      outcome.reason === "explicit_selection" ? "selected skill" : "matched skill";
    return `${prefix}:${outcome.skillId}@${outcome.skillVersion} · confidence:${Math.round(outcome.confidence * 100)}%`;
  }
  const candidateIds = outcome.trace.candidates
    .map((candidate) => candidate.skillId)
    .join(",");
  return `LLM fallback:${outcome.fallbackReason} · candidates:${candidateIds || "none"}`;
}


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

function getRepairVerifierRefeedStepName(attempt: number): string {
  return `repair_build:${attempt}:verifier_refeed`;
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
 * On checkpoint resume after chrome is done, list chrome files under
 * `components/chrome/**` so dependency install / traces see the full contract.
 */
function collectExistingChromeOwnedRelativePaths(): string[] {
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

async function runArchitectScaffoldStep(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  onStep?: (step: BuildStep) => void;
  referenceScreenshotDataUrl?: string | null;
  screenshotGuardrailId?: string | null;
}): Promise<{ files: string[]; summary: string; chromeForm: string }> {
  const {
    blueprint,
    designSystem,
    artifactLogger,
    logger,
    onStep,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
  } = params;

  const outcome = await logger.timed(
    ARCHITECT_SCAFFOLD_AGENT_STEP,
    () =>
      runArchitectScaffoldAgent({
        blueprint,
        designSystem,
        referenceScreenshotDataUrl: referenceScreenshotDataUrl ?? null,
        screenshotGuardrailId: screenshotGuardrailId ?? null,
        onStep,
      }),
    (r) => ({
      detail: `chrome=${r.chromeForm} · files=${r.files.length}${
        r.fellBackToMinimal ? " · minimal-fallback" : ""
      }`,
      trace: r.trace,
    })
  );

  await persistJsonArtifact(artifactLogger, ARCHITECT_SCAFFOLD_AGENT_STEP, "output", {
    layoutPath: outcome.layoutPath,
    chromeForm: outcome.chromeForm,
    files: outcome.files,
    summary: outcome.summary,
    fellBackToMinimal: outcome.fellBackToMinimal,
    toolInvocations: outcome.toolCallRecords,
  });
  await persistSiteFileArtifact(
    artifactLogger,
    ARCHITECT_SCAFFOLD_AGENT_STEP,
    outcome.layoutPath,
    "layout"
  );

  return {
    files: outcome.files,
    summary: outcome.summary,
    chromeForm: outcome.chromeForm,
  };
}

async function runChromeOptimizeStep(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  scaffoldSummary: string;
  scaffoldChromeForm: string;
  pageSummaries: PageImplementSummary[];
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  onStep?: (step: BuildStep) => void;
  referenceScreenshotDataUrl?: string | null;
  screenshotGuardrailId?: string | null;
}): Promise<{ files: string[] }> {
  const {
    blueprint,
    designSystem,
    scaffoldSummary,
    scaffoldChromeForm,
    pageSummaries,
    artifactLogger,
    logger,
    onStep,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
  } = params;

  const outcome = await logger.timed(
    CHROME_OPTIMIZE_AGENT_STEP,
    () =>
      runChromeOptimizeAgent({
        blueprint,
        designSystem,
        scaffoldContext: { summary: scaffoldSummary, chromeForm: scaffoldChromeForm },
        pageSummaries,
        referenceScreenshotDataUrl: referenceScreenshotDataUrl ?? null,
        screenshotGuardrailId: screenshotGuardrailId ?? null,
        onStep,
      }),
    (r) => ({
      detail: `chrome=${r.chromeForm} · files=${r.files.length}`,
      trace: r.trace,
    })
  );

  await persistJsonArtifact(artifactLogger, CHROME_OPTIMIZE_AGENT_STEP, "output", {
    layoutPath: outcome.layoutPath,
    chromeForm: outcome.chromeForm,
    files: outcome.files,
    summary: outcome.summary,
    toolInvocations: outcome.toolCallRecords,
  });
  await persistSiteFileArtifact(
    artifactLogger,
    CHROME_OPTIMIZE_AGENT_STEP,
    outcome.layoutPath,
    "layout"
  );

  return { files: outcome.files };
}

async function generatePages(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  skipImplementedPages?: Set<string>;
  onStep?: (step: BuildStep) => void;
  screenshotPageSpec?: PageSpec | null;
}): Promise<{
  files: string[];
  pendingImages: PendingImage[];
  pageSummaries: PageImplementSummary[];
}> {
  const {
    blueprint,
    designSystem,
    runtimeContext,
    artifactLogger,
    logger,
    skipImplementedPages,
    screenshotPageSpec,
  } = params;

  if (
    shouldUseScreenshotReplicaPipeline(runtimeContext) &&
    screenshotPageSpec
  ) {
    return generatePagesViaReplica({
      blueprint,
      pageSpec: screenshotPageSpec,
      designSystem,
      runtimeContext,
      artifactLogger,
      logger,
      skipImplementedPages,
      onStep: params.onStep,
    });
  }
  const collectedFiles: string[] = [];
  const collectedPendingImages: PendingImage[] = [];
  const collectedPageSummaries: PageImplementSummary[] = [];

  const pageOutcomes = await mapWithConcurrency(
    blueprint.site.pages,
    PAGE_IMPLEMENT_CONCURRENCY,
    async (page) => {
      const agentStepName = getPageImplementAgentStepName(page.slug);
      const pagePath = slugToPagePath(page.slug);
      if (skipImplementedPages?.has(page.slug)) {
        logger.logStep(agentStepName, "ok", "resumed from checkpoint");
        return {
          files: [pagePath],
          pendingImages: [],
          pageSummary: {
            slug: page.slug,
            title: page.title,
            summary: "resumed from checkpoint",
            pagePath,
          },
        };
      }

      const outcome = await logger.timed(
        agentStepName,
        async () =>
          runWithLangfuseSpanBranch(
            lfSpanGenPage(page.slug),
            async () =>
              runPageImplementAgent({
                page,
                designSystem,
                projectContext: runtimeContext,
                onStep: params.onStep,
              }),
            { metadata: { slug: page.slug, step: agentStepName } }
          ),
        (r) => ({
          detail: r.summary.slice(0, 260),
          trace: r.trace,
        }),
      );

      await persistJsonArtifact(artifactLogger, agentStepName, "output", {
        pagePath: outcome.pagePath,
        summary: outcome.summary,
        toolInvocations: outcome.toolCallRecords,
        pendingImagesCount: outcome.pendingImages.length,
      });
      await persistSiteFileArtifact(artifactLogger, agentStepName, outcome.pagePath, "page");

      return {
        files:
          outcome.writtenPaths.length > 0 ? outcome.writtenPaths : [outcome.pagePath],
        pendingImages: outcome.pendingImages,
        pageSummary: {
          slug: page.slug,
          title: page.title,
          summary: outcome.summary,
          pagePath: outcome.pagePath,
        },
      };
    }
  );

  for (const { files, pendingImages, pageSummary } of pageOutcomes) {
    collectedFiles.push(...files);
    collectedPendingImages.push(...pendingImages);
    collectedPageSummaries.push(pageSummary);
  }

  return {
    files: collectedFiles,
    pendingImages: collectedPendingImages,
    pageSummaries: collectedPageSummaries,
  };
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

    let repairResult = await logger.timed(
      getRepairStepName(repairRound + 1),
      () =>
        stepRepairBuild({
          blueprint,
          buildOutput: buildResult.output,
          generatedFiles: result.generatedFiles,
        }),
      (value) =>
        value.success
          ? `${value.touchedFiles.join(", ") || "repair applied"} (verifier=${describeVerifierVerdict(value.verifierVerdict)})`
          : value.output
    );
    await persistJsonArtifact(artifactLogger, getRepairStepName(repairRound + 1), "output", repairResult);

    if (!repairResult.success) {
      return {
        verificationStatus: "failed",
        verificationOutput: buildResult.output,
      };
    }

    // One code-scheduled re-repair when verifier is skeptical (fail/partial).
    if (repairVerifierNeedsRefeed(repairResult)) {
      const refeedStep = getRepairVerifierRefeedStepName(repairRound + 1);
      const firstRepair = repairResult;
      const refeedResult = await logger.timed(
        refeedStep,
        () =>
          stepRepairBuild({
            blueprint,
            buildOutput: buildVerifierRefeedBuildOutput({
              originalBuildOutput: buildResult.output,
              repairResult: firstRepair,
            }),
            generatedFiles: result.generatedFiles,
          }),
        (value) =>
          value.success
            ? `${value.touchedFiles.join(", ") || "refeed applied"} (verifier=${describeVerifierVerdict(value.verifierVerdict)})`
            : value.output
      );
      await persistJsonArtifact(artifactLogger, refeedStep, "output", refeedResult);
      if (refeedResult.success) {
        repairResult = {
          ...refeedResult,
          touchedFiles: mergeRepairTouchedFiles(firstRepair, refeedResult),
        };
      }
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
  selectedDesignSystemSkill?: SelectedDesignSystemSkill;
  /** When set, skips LLM infer_design_intent and uses this markdown instead. */
  confirmedDesignDirectionMarkdown?: string;
  confirmedDesignDirectionKeywords?: string[];
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
  /**
   * Continue an existing Langfuse root (intent commit → worker). When set,
   * {@link ensureLangfuseGenerateTrace} upserts this id instead of minting a new one.
   */
  langfuseTraceId?: string;
  /** Appended to default Langfuse trace tags (`flow:project_build`). */
  langfuseTraceTags?: string[];
  /** Shallow-merged into default trace metadata (`projectId` is always set). */
  langfuseTraceMetadata?: Record<string, unknown>;
  /** When set, replaces the default trace `input` snapshot for the root observation. */
  langfuseTraceInput?: unknown;
  /** When set, passed into `project_intent_guide` vision (direct /api/ai or worker). */
  userReferenceImageBase64?: string | null;
  /**
   * @deprecated Unused after removing `extract_user_provided_content` from the generate pipeline.
   * Kept optional for older callers / payloads.
   */
  userImageSourceTexts?: string[];
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
      ? ["flow:project_build", ...extraTags]
      : ["flow:project_build"];
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
      ...(options.langfuseTraceId ? { id: options.langfuseTraceId } : {}),
      name: LfTrace.projectBuild,
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

  const cp = options.checkpoint;

  const runPipeline = async (): Promise<void> => {
  try {
    // Always validate skill files (skills are enabled by default)
    {
      const skillFrontmatterErrors = validateSkillFrontmatter(getSkillPromptsRoot());
      const designSystemSkillErrors = validateDesignSystemSkillCatalog();
      if (skillFrontmatterErrors.length > 0 || designSystemSkillErrors.length > 0) {
        const detail = [
          ...skillFrontmatterErrors.map((e) => `${e.fileName}: ${e.message}`),
          ...designSystemSkillErrors,
        ].join(" | ");
        logger.logStep("validate_skill_prompts", "error", detail);
        throw new Error(`Invalid skill prompt frontmatter: ${detail}`);
      }
      logger.logStep("validate_skill_prompts", "ok", "all skill files validated");
    }

    logger.logStep("generation_started", "ok", "starting requirement analysis");

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
      const intentResult = await withLangfuseSpan(
        LfSpanGen.intentGuide,
        () =>
          stepProjectIntentGuide(userInput, {
            imageBase64: options.userReferenceImageBase64 ?? null,
          }),
        {
          getOutput: (r) => ({
            outcome: r.outcome,
            phase: r.phase,
            appendixChars: r.buildPromptAppendix?.length ?? 0,
          }),
        }
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
    const blockSkillsForScreenshotReplicate = shouldBlockSkillsForScreenshotReplicate(
      screenshotIntentMode,
      Boolean(referenceScreenshot),
      effectiveUserInput
    );

    let researchBrief: string | null = null;
    const referenceSiteUrls = listReferenceSiteCandidateUrls(effectiveUserInput);
    if (!cp?.skipAnalyze && referenceSiteUrls.length > 0) {
      logger.startStep("research_reference_sites");
      const researchResult = await withLangfuseSpan(
        LfSpanGen.researchReferenceSites,
        () =>
          runResearchSubagent({
            userBrief: effectiveUserInput,
            candidateUrls: referenceSiteUrls,
            model: getModelForStep("analyze_project_requirement"),
          })
      );
      if (researchResult?.ok && researchResult.summary.trim()) {
        researchBrief = formatResearchBriefForParent(researchResult);
        logger.logStep(
          "research_reference_sites",
          "ok",
          `${referenceSiteUrls.length} url(s), ${researchResult.toolCallCount} tool calls`
        );
        await persistTextArtifact(
          artifactLogger,
          "research_reference_sites",
          "brief",
          researchBrief,
          "md"
        );
      } else {
        logger.logStep(
          "research_reference_sites",
          "ok",
          researchResult
            ? `skipped_or_failed: ${researchResult.error ?? "empty summary"}`
            : "skipped: no research run"
        );
        await persistJsonArtifact(artifactLogger, "research_reference_sites", "output", {
          ok: researchResult?.ok ?? false,
          error: researchResult?.error ?? null,
          urls: referenceSiteUrls,
        });
      }
    }

    let rawBlueprint!: ProjectBlueprint;
    let inferredDesignIntent: DesignIntentResult | null = null;
    const confirmedDesignMarkdown = options.confirmedDesignDirectionMarkdown?.trim() || "";
    const confirmedDesignKeywords = (options.confirmedDesignDirectionKeywords ?? [])
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (cp?.skipAnalyze && cp.cachedBlueprint) {
      rawBlueprint = cp.cachedBlueprint;
      logger.logStep("analyze_project_requirement", "ok", "resumed from checkpoint");

      if (confirmedDesignMarkdown) {
        inferredDesignIntent = {
          text: confirmedDesignMarkdown,
          technicalKeywords: confirmedDesignKeywords,
        };
        logger.logStep("infer_design_intent", "ok", "user-confirmed vibe direction");
        await writeSiteFile("design-intent.md", confirmedDesignMarkdown);
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntent.text, "md");
      } else if (rawBlueprint.experience?.designIntent?.keywords?.length) {
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
    } else if (confirmedDesignMarkdown) {
      await withLangfuseSpan(LfSpanGen.analyzeBlueprintParallel, async () => {
        logger.startStep("analyze_project_requirement");
        logger.startStep("infer_design_intent");

        const analyzeResult = await stepAnalyzeProjectRequirement(
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
          {
            referenceImageBase64: referenceScreenshot,
            screenshotGuardrailId,
            researchBrief,
          }
        );

        inferredDesignIntent = {
          text: confirmedDesignMarkdown,
          technicalKeywords: confirmedDesignKeywords,
        };

        logger.logStep(
          "analyze_project_requirement",
          "ok",
          `${analyzeResult.blueprint.brief.roles.length} roles, ${analyzeResult.blueprint.site.pages.length} pages planned`,
          undefined,
          analyzeResult.trace
        );
        logger.logStep("infer_design_intent", "ok", "user-confirmed vibe direction");
        rawBlueprint = { ...analyzeResult.blueprint, userProvidedContent: undefined };
        await writeSiteFile("design-intent.md", confirmedDesignMarkdown);
        await persistJsonArtifact(artifactLogger, "analyze_project_requirement", "output", rawBlueprint);
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntent.text, "md");
      });
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
            {
              referenceImageBase64: referenceScreenshot,
              screenshotGuardrailId,
              researchBrief,
            }
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
        rawBlueprint = { ...analyzeResult.blueprint, userProvidedContent: undefined };
        inferredDesignIntent = inferResult;
        await persistJsonArtifact(artifactLogger, "analyze_project_requirement", "output", rawBlueprint);
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntent.text, "md");
      });
    }

    if (!rawBlueprint.experience) {
      rawBlueprint.experience = emptyProjectExperience();
    }

    // Inject Infer / user-confirmed keywords before Plan so it never sees SaaS filler defaults.
    rawBlueprint = applyDesignKeywordsBeforePlan(rawBlueprint, {
      confirmedKeywords: confirmedDesignKeywords,
      inferredKeywords: inferredDesignIntent?.technicalKeywords,
    });

    const normalizedBlueprint = normalizeBlueprint(rawBlueprint);
    const pageGenerationScreenshotMode = resolvePageGenerationScreenshotMode(
      screenshotIntentMode,
      normalizedBlueprint.site.pages.length
    );
    const pageGenerationScreenshotGuardrailId = screenshotGuardrailIdForMode(
      pageGenerationScreenshotMode
    );

    // ── Steps: plan_project → generate_project_design_system ──
    let blueprint!: PlannedProjectBlueprint;
    let designSystem!: string;
    let screenshotPageSpec: PageSpec | null = null;

    const replicaPipelineEligible =
      isScreenshotReplicaPipelineEnabled() &&
      pageGenerationScreenshotMode === "replicate_layout" &&
      Boolean(referenceScreenshot);

    if (cp?.skipPlanAndDesign && cp.cachedBlueprint && cp.cachedDesignSystem) {
      blueprint = cp.cachedBlueprint;
      designSystem = cp.cachedDesignSystem;
      logger.logStep("plan_project", "ok", "resumed from checkpoint");
      logger.logStep("generate_project_design_system", "ok", "resumed from checkpoint");
      if (replicaPipelineEligible) {
        screenshotPageSpec = tryLoadPageSpecFromSite(readSiteFile);
        if (screenshotPageSpec) {
          const sections = pageSpecSectionsToPlannedSections(screenshotPageSpec.sections);
          blueprint = mergePageSpecSectionsIntoBlueprint(blueprint, sections);
          logger.logStep(
            ANALYZE_SCREENSHOT_LAYOUT_STEP,
            "ok",
            `resumed — ${sections.length} sections from screenshot-page-spec.json`
          );
        }
      }
    } else {
      await withLangfuseSpan(LfSpanGen.planAndDesignSystem, async () => {
        logger.startStep("plan_project");

        // Build a fallback markdown text from blueprint's designIntent if inferDesignIntent returned empty
        const designIntentForSystem = inferredDesignIntent?.text || (() => {
          const di = rawBlueprint.experience?.designIntent;
          if (!di) return "";
          return `## Design Intent\n- Mood: ${di.mood.join(", ")}\n- Color Direction: ${di.colorDirection}\n- Style: ${di.style}\n- Keywords: ${di.keywords.join(", ")}`;
        })();

        // Resolution only needs design intent (+ optional style guide), not plan sections.
        // Expose matching separately so Studio can show retrieval/judging before reuse/fallback.
        logger.startStep("match_design_system_skill");
        let matchResolved = false;
        const designPromise = resolveDesignSystem(
          {
            userInput: effectiveUserInput,
            designIntentMarkdown: designIntentForSystem,
            projectType: normalizedBlueprint.brief.productScope.productType,
            screenshotMode: pageGenerationScreenshotMode,
            selectedSkill: options.selectedDesignSystemSkill,
            legacyStyleGuide: options.styleGuide,
            matchingEnabled:
              options.enableSkills !== false &&
              process.env.DESIGN_SYSTEM_SKILL_FAST_PATH !== "0",
          },
          {
            onMatchResolved: (outcome) => {
              matchResolved = true;
              logger.logStep(
                "match_design_system_skill",
                "ok",
                formatDesignSystemMatchDetail(outcome),
                outcome.source === "skill" ? outcome.skillId : undefined,
                outcome.trace.judgeTrace,
              );
              logger.startStep("generate_project_design_system");
            },
          },
        ).catch((error) => {
          logger.logStep(
            matchResolved
              ? "generate_project_design_system"
              : "match_design_system_skill",
            "error",
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        });

        const planOutcome = await stepPlanProject(normalizedBlueprint).then((out) => {
          logger.logStep("plan_project", "ok", "page-level blueprints prepared", undefined, out.trace);
          return out;
        });

        blueprint = planOutcome.blueprint;

        if (replicaPipelineEligible && referenceScreenshot) {
          logger.startStep(ANALYZE_SCREENSHOT_LAYOUT_STEP);
          const layoutResult = await stepAnalyzeScreenshotLayout({
            userInput: effectiveUserInput,
            referenceScreenshotDataUrl: referenceScreenshot,
            page: blueprint.site.pages[0],
          });
          screenshotPageSpec = layoutResult.pageSpec;
          blueprint = mergePageSpecSectionsIntoBlueprint(blueprint, layoutResult.sections);
          logger.logStep(
            ANALYZE_SCREENSHOT_LAYOUT_STEP,
            "ok",
            `${layoutResult.sections.length} sections from screenshot`,
            undefined,
            layoutResult.trace
          );
          await persistJsonArtifact(
            artifactLogger,
            ANALYZE_SCREENSHOT_LAYOUT_STEP,
            "output",
            layoutResult.pageSpec
          );
        }

        const designResolution = await designPromise;
        designSystem = designResolution.designSystem;
        await writeSiteFile("design-system.md", designSystem);
        logger.logStep(
          "generate_project_design_system",
          "ok",
          designResolution.source === "skill"
            ? `reused skill:${designResolution.skillId}@${designResolution.skillVersion}`
            : `LLM generated · reason:${designResolution.fallbackReason}`,
          designResolution.source === "skill" ? designResolution.skillId : undefined,
          designResolution.source === "skill"
            ? designResolution.trace.judgeTrace
            : designResolution.trace.generationTrace,
        );
        await persistJsonArtifact(
          artifactLogger,
          "generate_project_design_system",
          "resolution",
          {
            source: designResolution.source,
            ...(designResolution.source === "skill"
              ? {
                  skillId: designResolution.skillId,
                  skillVersion: designResolution.skillVersion,
                  confidence: designResolution.confidence,
                  reason: designResolution.reason,
                }
              : { fallbackReason: designResolution.fallbackReason }),
            candidates: designResolution.trace.candidates,
            decision: designResolution.trace.decision ?? null,
          },
        );

        // Keywords already applied before plan_project (confirmed > infer). Keep plan output in sync.
        if (normalizedBlueprint.experience?.designIntent?.keywords?.length) {
          blueprint.experience.designIntent.keywords =
            normalizedBlueprint.experience.designIntent.keywords;
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
    runtimeContext.screenshotIntentMode = pageGenerationScreenshotMode;
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
      const tokenResult = await withLangfuseSpan(
        LfSpanGen.applyDesignTokens,
        () =>
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
          ),
        {
          getOutput: (r) => ({ files: r.files }),
        }
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

    // ── Chrome-first: real shell → shared stubs → parallel pages → link polish ─
    let scaffoldSummary = "";
    let scaffoldChromeForm = "unspecified";
    const skipChromeScaffold =
      blockSkillsForScreenshotReplicate && blueprint.site.pages.length === 1;
    // Agent-chosen chromeForm only — never invent from productType heuristics.
    const plannedChromeForm = resolveChromeForm({
      chromeForm: blueprint.site.informationArchitecture.chromeForm,
    });
    blueprint.site.informationArchitecture.chromeForm = plannedChromeForm;

    if (skipChromeScaffold) {
      const { layoutPath, removedChromeDir } = await prepareReplicaSiteLayout(blueprint);
      const replicaScaffoldDetail = cp?.skipScaffold
        ? `replica layout enforced on resume${removedChromeDir ? " · chrome removed" : ""}`
        : `skipped — screenshot replicate (pass-through layout${removedChromeDir ? ", chrome stripped" : ""})`;
      logger.logStep(ARCHITECT_SCAFFOLD_AGENT_STEP, "ok", replicaScaffoldDetail);
      await persistJsonArtifact(artifactLogger, ARCHITECT_SCAFFOLD_AGENT_STEP, "output", {
        layoutPath,
        chromeForm: "none",
        skipped: true,
        removedChromeDir,
        reason: "screenshot replicate — page owns full chrome",
      });
      await persistSiteFileArtifact(
        artifactLogger,
        ARCHITECT_SCAFFOLD_AGENT_STEP,
        layoutPath,
        "layout"
      );
      appendGeneratedFiles(result, [layoutPath]);
      scaffoldSummary = "screenshot replicate: minimal pass-through layout";
      scaffoldChromeForm = "none";
    } else if (cp?.skipScaffold) {
      appendGeneratedFiles(result, collectExistingChromeOwnedRelativePaths());
      scaffoldSummary = "resumed: chrome scaffold already complete";
      scaffoldChromeForm = plannedChromeForm;
    } else {
      // Always scaffold shell (Nav / Sidebar / Footer / tabs). chromeForm never skips.
      const scaffoldResult = await withLangfuseSpan(LfSpanGen.architectScaffoldAgent, () =>
        runArchitectScaffoldStep({
          blueprint,
          designSystem,
          artifactLogger,
          logger,
          onStep,
          referenceScreenshotDataUrl: referenceScreenshot,
          screenshotGuardrailId: pageGenerationScreenshotGuardrailId,
        })
      );
      appendGeneratedFiles(result, scaffoldResult.files);
      scaffoldSummary = scaffoldResult.summary;
      scaffoldChromeForm = scaffoldResult.chromeForm || plannedChromeForm;
      blueprint.site.informationArchitecture.chromeForm = scaffoldChromeForm;
    }

    // Shared list/detail stubs before parallel page agents (ownership serial).
    const sharedContracts = blueprint.site.informationArchitecture.sharedContracts ?? [];
    if (sharedContracts.length > 0 && !skipChromeScaffold) {
      const stubPaths = writeSharedContractStubs(sharedContracts);
      if (stubPaths.length > 0) {
        appendGeneratedFiles(result, stubPaths);
        logger.logStep(
          "shared_contract_stubs",
          "ok",
          `wrote ${stubPaths.length} shared stub(s): ${stubPaths.join(", ")}`
        );
        await persistJsonArtifact(artifactLogger, "shared_contract_stubs", "output", {
          files: stubPaths,
          contracts: sharedContracts,
        });
      }
    }

    const pageOutcome = await withLangfuseSpan(
      LfSpanGen.implementPages,
      () =>
        generatePages({
          blueprint,
          designSystem,
          runtimeContext,
          artifactLogger,
          logger,
          skipImplementedPages: cp?.implementedPages,
          onStep,
          screenshotPageSpec,
        }),
      {
        getOutput: (r) => ({
          pageCount: r.pageSummaries.length,
          fileCount: r.files.length,
          pendingImageCount: r.pendingImages.length,
        }),
      }
    );
    appendGeneratedFiles(result, pageOutcome.files);
    const allPendingImages = pageOutcome.pendingImages;

    const allPagesImplemented =
      pageOutcome.pageSummaries.length === blueprint.site.pages.length;

    if (allPagesImplemented && !cp?.skipChromeOptimize) {
      if (skipChromeScaffold) {
        logger.logStep(
          CHROME_OPTIMIZE_AGENT_STEP,
          "ok",
          "skipped — screenshot replicate (page sections own header/footer)"
        );
      } else {
        const optimizeResult = await withLangfuseSpan(LfSpanGen.chromeOptimizeAgent, () =>
          runChromeOptimizeStep({
            blueprint,
            designSystem,
            scaffoldSummary,
            scaffoldChromeForm,
            pageSummaries: pageOutcome.pageSummaries,
            artifactLogger,
            logger,
            onStep,
            referenceScreenshotDataUrl: referenceScreenshot,
            screenshotGuardrailId: pageGenerationScreenshotGuardrailId,
          })
        );
        appendGeneratedFiles(result, optimizeResult.files);
      }
    } else if (cp?.skipChromeOptimize) {
      appendGeneratedFiles(result, collectExistingChromeOwnedRelativePaths());
    }
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
        let repairResult = await withLangfuseSpan(
          LfSpanGen.typescriptRepair,
          () =>
            stepRepairBuild({
              blueprint,
              buildOutput: scoped.tscStyleLog,
              generatedFiles: result.generatedFiles,
            })
        );
        if (
          repairResult.success &&
          repairVerifierNeedsRefeed(repairResult)
        ) {
          const firstRepair = repairResult;
          const refeedResult = await withLangfuseSpan(
            LfSpanGen.typescriptRepair,
            () =>
              stepRepairBuild({
                blueprint,
                buildOutput: buildVerifierRefeedBuildOutput({
                  originalBuildOutput: scoped.tscStyleLog,
                  repairResult: firstRepair,
                }),
                generatedFiles: result.generatedFiles,
              })
          );
          if (refeedResult.success) {
            repairResult = {
              ...refeedResult,
              touchedFiles: mergeRepairTouchedFiles(firstRepair, refeedResult),
            };
          }
        }
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

    const buildLifecycle = await withLangfuseSpan(
      LfSpanGen.buildVerifyAndRepair,
      () => runBuildWithRepair({ blueprint, artifactLogger, result, logger }),
      {
        getOutput: (r) => ({
          verificationStatus: r.verificationStatus,
          outputChars: r.verificationOutput?.length ?? 0,
        }),
      }
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
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.success = false;
    await persistJsonArtifact(artifactLogger, "run", "error", {
      error: result.error,
    });
  }
  };

  if (getLangfuse() && getLangfuseRunContext()) {
    await withLangfuseSpan(LfSpanGen.fullPipeline, runPipeline, {
      input: {
        projectId: options.projectId,
        enableIntentGuide: options.enableIntentGuide !== false,
        enableSkills: options.enableSkills !== false,
      },
      getOutput: () => ({
        success: result.success,
        error: result.error ?? null,
        intentGuideDeferred: Boolean(result.intentGuideDeferred),
        stepCount: result.steps.length,
        totalDurationMs: result.totalDuration,
        generatedFileCount: result.generatedFiles?.length ?? 0,
      }),
    });
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
