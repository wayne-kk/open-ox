import { clearTemplate } from "@/lib/clearTemplate";
import { getSiteRoot as projectManagerGetSiteRoot } from "@/lib/projectManager";
import { setSiteRoot, getSiteRoot } from "@/ai/tools/system/common";
import { setSectionSkillsEnabled, getModelId } from "@/lib/config/models";
import { validateSkillFrontmatter } from "@/ai/shared/skillDiscovery";
import { execSync } from "child_process";
import { formatSiteFile, syncSiteValidationMarkers, readSiteFile, writeSiteFile, getSkillPromptsRoot } from "./shared/files";
import { createArtifactLogger, createStepLogger } from "./shared/logging";
import { buildScreenFilePath, buildSectionFilePath } from "./shared/paths";
import { stepAnalyzeProjectRequirement } from "./steps/analyzeProjectRequirement";
import { stepApplyProjectDesignTokens } from "./steps/applyProjectDesignTokens";
import { stepComposeLayout } from "./steps/composeLayout";
import { stepComposePage } from "./steps/composePage";
import { stepGenerateScreen } from "./steps/generateScreen";
import { stepGenerateProjectDesignSystem } from "./steps/generateProjectDesignSystem";
import { stepMatchDesignSystemSkill } from "./steps/matchDesignSystemSkill";
import { stepGenerateSection } from "./steps/generateSection";
import { stepInstallDependencies } from "./steps/installDependencies";
import { stepInferDesignIntent } from "./steps/inferDesignIntent";
import { stepPlanProject } from "./steps/planProject";
import { stepRepairBuild } from "./steps/repairBuild";
import { stepRunBuild } from "./steps/runBuild";
import { stepDescribePageSections } from "./steps/describePageSections";
import { normalizeBlueprint } from "./normalization/blueprintNormalizer";
import {
  appendDependencyInstallFailures,
  appendGeneratedFiles,
  appendInstalledDependencies,
  createInitialResult,
} from "./orchestration/resultAccumulator";
import type { BuildStep, GenerateProjectResult, PlannedProjectBlueprint, PlannedSectionSpec, ProjectBlueprint } from "./types";
import type { ArtifactLogger, StepLogger } from "./shared/logging";
import type { GenerateSectionParams } from "./steps/generateSection";
import type { PendingImage } from "../../tools/system/generateImageTool";
import { awaitPendingImages } from "../../tools/system/generateImageTool";
import type { CheckpointResult } from "./shared/checkpoint";
import { getPromptProfile } from "@/ai/prompts/core/profile";


function summarizeFailures(prefix: string, failures: Array<{ name: string; message: string }>): string {
  const detail = failures.map((failure) => `${failure.name}: ${failure.message}`).join("; ");
  return `${prefix}: ${detail}`;
}

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

type ProjectRuntimeContext = GenerateSectionParams["projectContext"] & {
  projectGuardrailIds: GenerateSectionParams["projectGuardrailIds"];
};

interface SectionBatchItem {
  scopeKey: string;
  section: PlannedSectionSpec;
  outputFileRelative: string;
  pageContext?: GenerateSectionParams["pageContext"];
  sectionDesignBrief?: string;
}

const SECTION_PARALLELISM = Math.max(
  1,
  Number(process.env.GENERATE_SECTION_PARALLELISM ?? 2)
);

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }
      try {
        const value = await worker(items[current], current);
        results[current] = { status: "fulfilled", value };
      } catch (error) {
        results[current] = { status: "rejected", reason: error };
      }
    }
  };

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    runWorker()
  );
  await Promise.all(runners);
  return results;
}


function buildProjectRuntimeContext(blueprint: PlannedProjectBlueprint): ProjectRuntimeContext {
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
    projectGuardrailIds: blueprint.projectGuardrailIds,
    designKeywords: blueprint.experience.designIntent.keywords ?? [],
    rawUserInput: "",
  };
}


function getSectionStepName(scopeKey: string, fileName: string): string {
  return `generate_section:${scopeKey}:${fileName}`;
}

function getComposePageStepName(slug: string): string {
  return `compose_page:${slug}`;
}

function getDescribePageSectionsStepName(slug: string): string {
  return `describe_page_sections:${slug}`;
}

function getGenerateScreenStepName(slug: string): string {
  return `generate_screen:${slug}`;
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

function buildAppScreenFirstLayout(language: string): string {
  const lang = language?.trim() || "en";
  return `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Generated App",
  description: "Screen-first generated app experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="${lang}">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;
}

async function ensureAppScreenFirstLayout(params: {
  language: string;
  artifactLogger: ArtifactLogger;
}): Promise<string> {
  const { language, artifactLogger } = params;
  const layoutPath = "app/layout.tsx";
  const content = buildAppScreenFirstLayout(language);
  await writeSiteFile(layoutPath, content);
  await formatSiteFile(layoutPath);
  await persistJsonArtifact(artifactLogger, "compose_layout", "output", {
    layoutPath,
    mode: "app-screen-first",
    language,
  });
  await persistSiteFileArtifact(artifactLogger, "compose_layout", layoutPath, "layout");
  return layoutPath;
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

    const installResult = await stepInstallDependencies({
      files: uniqueFiles,
      buildOutput,
    });
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

interface BuildLifecycleResult {
  verificationStatus: GenerateProjectResult["verificationStatus"];
  verificationOutput: string;
}

async function runSectionBatch(params: {
  batchLabel: string;
  items: SectionBatchItem[];
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  trajectoryCollector?: import("./trajectoryCollector").GenerateTrajectoryCollector;
}): Promise<{ generatedFiles: string[]; pendingImages: PendingImage[] }> {
  const { batchLabel, items, designSystem, runtimeContext, artifactLogger, logger, trajectoryCollector } = params;
  if (items.length === 0) {
    return { generatedFiles: [], pendingImages: [] };
  }

  const results = await mapWithConcurrency(items, SECTION_PARALLELISM, (item) => {
    const stepName = getSectionStepName(item.scopeKey, item.section.fileName);
    logger.startStep(stepName);
    const onMessage = trajectoryCollector
      ? trajectoryCollector.createEpisodeCollector(`generate_section:${item.section.fileName}`)
      : undefined;
    return stepGenerateSection({
      designSystem,
      projectGuardrailIds: runtimeContext.projectGuardrailIds,
      projectContext: runtimeContext,
      section: item.section,
      outputFileRelative: item.outputFileRelative,
      pageContext: item.pageContext,
      sectionDesignBrief: item.sectionDesignBrief ?? "",
      onMessage,
    });
  }
  );

  const generatedFiles: string[] = [];
  const allPendingImages: PendingImage[] = [];
  const failures: Array<{ name: string; message: string }> = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const result = results[index];
    const stepName = getSectionStepName(item.scopeKey, item.section.fileName);

    if (result.status === "fulfilled") {
      const { filePath, skillId, trace, pendingImages } = result.value;
      generatedFiles.push(filePath);
      allPendingImages.push(...pendingImages);
      logger.logStep(stepName, "ok", filePath, skillId);
      logger.attachTrace(stepName, trace);
      await persistJsonArtifact(artifactLogger, stepName, "output", {
        outputFileRelative: item.outputFileRelative,
        generatedFile: result.value.filePath,
        skillId: result.value.skillId,
        section: item.section,
        pageContext: item.pageContext ?? null,
      });
      await persistSiteFileArtifact(
        artifactLogger,
        stepName,
        item.outputFileRelative,
        "generated-file"
      );
      continue;
    }

    const message =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    failures.push({ name: item.section.fileName, message });
    logger.logStep(stepName, "error", message);
    await persistJsonArtifact(artifactLogger, stepName, "error", {
      message,
      outputFileRelative: item.outputFileRelative,
      section: item.section,
      pageContext: item.pageContext ?? null,
    });
  }

  if (failures.length > 0) {
    throw new Error(summarizeFailures(`${batchLabel} section generation failed`, failures));
  }

  return { generatedFiles, pendingImages: allPendingImages };
}

async function generateSharedLayoutSections(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  skipSections?: Set<string>;
  trajectoryCollector?: import("./trajectoryCollector").GenerateTrajectoryCollector;
}): Promise<{ files: string[]; pendingImages: PendingImage[] }> {
  const { blueprint, designSystem, runtimeContext, artifactLogger, logger, skipSections, trajectoryCollector } = params;
  const collectedFiles: string[] = [];
  const collectedPendingImages: PendingImage[] = [];

  if (blueprint.site.layoutSections.length === 0) {
    return { files: collectedFiles, pendingImages: collectedPendingImages };
  }

  // Filter out already-generated sections
  const sectionsToGenerate = skipSections
    ? blueprint.site.layoutSections.filter((s) => !skipSections.has(`layout:${s.fileName}`))
    : blueprint.site.layoutSections;

  // Log skipped sections
  const skippedCount = blueprint.site.layoutSections.length - sectionsToGenerate.length;
  if (skippedCount > 0) {
    logger.logStep("checkpoint_skip_layout", "ok", `${skippedCount} layout section(s) resumed from checkpoint`);
    // Add already-generated files to result
    for (const section of blueprint.site.layoutSections) {
      if (skipSections?.has(`layout:${section.fileName}`)) {
        collectedFiles.push(buildSectionFilePath("layout", section.fileName));
      }
    }
  }

  if (sectionsToGenerate.length > 0) {
    const batchResult = await runSectionBatch({
      batchLabel: "layout",
      items: sectionsToGenerate.map((section) => ({
        scopeKey: "layout",
        section,
        outputFileRelative: buildSectionFilePath("layout", section.fileName),
      })),
      designSystem,
      runtimeContext,
      artifactLogger,
      logger,
      trajectoryCollector,
    });
    collectedFiles.push(...batchResult.generatedFiles);
    collectedPendingImages.push(...batchResult.pendingImages);
  }

  const layoutPath = await logger.timed(
    "compose_layout",
    () => stepComposeLayout(blueprint.site.layoutSections, blueprint),
    (path) => path ?? "layout unchanged"
  );
  if (layoutPath) {
    collectedFiles.push(layoutPath);
    await persistJsonArtifact(artifactLogger, "compose_layout", "output", {
      layoutPath,
      layoutSections: blueprint.site.layoutSections.map((section) => section.fileName),
    });
    await persistSiteFileArtifact(artifactLogger, "compose_layout", layoutPath, "layout");
  }

  return { files: collectedFiles, pendingImages: collectedPendingImages };
}

async function generatePages(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  appScreenFirstEnabled: boolean;
  skipSections?: Set<string>;
  skipPages?: Set<string>;
  trajectoryCollector?: import("./trajectoryCollector").GenerateTrajectoryCollector;
}): Promise<{ files: string[]; pendingImages: PendingImage[] }> {
  const {
    blueprint,
    designSystem,
    runtimeContext,
    artifactLogger,
    logger,
    appScreenFirstEnabled,
    skipSections,
    skipPages,
    trajectoryCollector,
  } = params;
  const collectedFiles: string[] = [];
  const collectedPendingImages: PendingImage[] = [];

  // Pages are independent (distinct output paths per slug); run in parallel for wall-clock time.
  const pageOutcomes = await Promise.all(
    blueprint.site.pages.map(async (page) => {
      if (appScreenFirstEnabled) {
        const screenStepName = getGenerateScreenStepName(page.slug);
        const screenOutput = buildScreenFilePath(page.slug);
        logger.startStep(screenStepName);
        const screenResult = await stepGenerateScreen({
          page,
          designSystem,
          projectContext: runtimeContext,
          outputFileRelative: screenOutput,
        });
        logger.logStep(
          screenStepName,
          "ok",
          `${screenResult.filePath}${screenResult.skillIds.length ? ` | ${screenResult.skillIds.join(", ")}` : ""}`
        );
        await persistJsonArtifact(artifactLogger, screenStepName, "output", {
          slug: page.slug,
          outputFile: screenResult.filePath,
          skillIds: screenResult.skillIds,
          appScreenPlan: page.appScreenPlan ?? null,
        });
        await persistSiteFileArtifact(
          artifactLogger,
          screenStepName,
          screenResult.filePath,
          "screen"
        );

        if (skipPages?.has(page.slug)) {
          const pagePath = page.slug === "home" ? "app/page.tsx" : `app/${page.slug}/page.tsx`;
          logger.logStep(getComposePageStepName(page.slug), "ok", "resumed from checkpoint");
          return { files: [screenResult.filePath, pagePath], pendingImages: [] };
        }

        const pagePath = await logger.timed(
          getComposePageStepName(page.slug),
          () =>
            stepComposePage(page, designSystem, [], {
              appScreenComponentName: "AppScreen",
            }),
          (path) => path
        );
        await persistJsonArtifact(artifactLogger, getComposePageStepName(page.slug), "output", {
          pagePath,
          slug: page.slug,
          title: page.title,
          composeMode: "app-screen-first",
          screenComponent: "AppScreen",
          screenFile: screenResult.filePath,
        });
        await persistSiteFileArtifact(
          artifactLogger,
          getComposePageStepName(page.slug),
          pagePath,
          "page"
        );
        return { files: [screenResult.filePath, pagePath], pendingImages: [] };
      }

      // Deduplicate page sections by fileName to prevent duplicate generation
      const seenFileNames = new Set<string>();
      const dedupedSections = page.sections.filter((s) => {
        if (seenFileNames.has(s.fileName)) return false;
        seenFileNames.add(s.fileName);
        return true;
      });

      // Filter out already-generated sections for this page
      const sectionsToGenerate = skipSections
        ? dedupedSections.filter((s) => !skipSections.has(`${page.slug}:${s.fileName}`))
        : dedupedSections;

      const describeStepName = getDescribePageSectionsStepName(page.slug);
      const pageDesign = await logger.timed(
        describeStepName,
        () =>
          stepDescribePageSections({
            designSystem,
            language: runtimeContext.language,
            page,
            sections: dedupedSections,
          }),
        () => `${dedupedSections.length} section brief(s)`
      );
      const sectionBriefByFile = new Map(
        pageDesign.sectionDesigns.map((design) => [design.fileName, design.sectionDesignBrief])
      );

      // Persist page design brief for topology inspection
      const pageDesignDoc = [
        `# ${page.title} (/${page.slug})`,
        "",
        "## 页面整体结构",
        pageDesign.pageStructure,
        "",
        ...pageDesign.sectionDesigns.map((d) => [
          `## ${d.fileName} (${d.sectionType})`,
          d.sectionDesignBrief,
          "",
        ]).flat(),
      ].join("\n");
      await persistTextArtifact(
        artifactLogger,
        describeStepName,
        "output",
        "md",
        pageDesignDoc
      );

      // Log skipped sections
      const skippedCount = dedupedSections.length - sectionsToGenerate.length;
      if (skippedCount > 0) {
        logger.logStep(
          `checkpoint_skip_${page.slug}`,
          "ok",
          `${skippedCount} section(s) resumed from checkpoint`
        );
      }

      // Collect files that were already generated (from checkpoint)
      const resumedFiles: string[] = [];
      for (const section of dedupedSections) {
        if (skipSections?.has(`${page.slug}:${section.fileName}`)) {
          resumedFiles.push(buildSectionFilePath(page.slug, section.fileName));
        }
      }

      let generatedFiles: string[] = [];
      let pagePendingImages: PendingImage[] = [];
      if (sectionsToGenerate.length > 0) {
        const batchResult = await runSectionBatch({
          batchLabel: `page ${page.slug}`,
          items: sectionsToGenerate.map((section) => ({
            scopeKey: page.slug,
            section,
            outputFileRelative: buildSectionFilePath(page.slug, section.fileName),
            sectionDesignBrief: sectionBriefByFile.get(section.fileName) ?? "",
            pageContext: {
              title: page.title,
              slug: page.slug,
              description: page.description,
              journeyStage: page.journeyStage,
            },
          })),
          designSystem,
          runtimeContext,
          artifactLogger,
          logger,
          trajectoryCollector,
        });
        generatedFiles = batchResult.generatedFiles;
        pagePendingImages = batchResult.pendingImages;
      }

      // Skip compose_page if already done
      if (skipPages?.has(page.slug)) {
        const pagePath = page.slug === "home" ? "app/page.tsx" : `app/${page.slug}/page.tsx`;
        logger.logStep(getComposePageStepName(page.slug), "ok", "resumed from checkpoint");
        return { files: [...resumedFiles, ...generatedFiles, pagePath], pendingImages: pagePendingImages };
      }

      // Deduplicate sections by fileName before composing the page
      const pagePath = await logger.timed(
        getComposePageStepName(page.slug),
        () => stepComposePage(page, designSystem, dedupedSections),
        (path) => path
      );

      await persistJsonArtifact(artifactLogger, getComposePageStepName(page.slug), "output", {
        pagePath,
        slug: page.slug,
        title: page.title,
        pageStructure: pageDesign.pageStructure,
        sections: dedupedSections.map((section) => section.fileName),
      });
      await persistSiteFileArtifact(
        artifactLogger,
        getComposePageStepName(page.slug),
        pagePath,
        "page"
      );

      return { files: [...resumedFiles, ...generatedFiles, pagePath], pendingImages: pagePendingImages };
    })
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
  const maxRepairAttempts = 2;
  let lastBuildOutput = "";

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
    const buildStepName = getBuildStepName(attempt);
    logger.startStep(buildStepName);
    const buildResult = await stepRunBuild();
    lastBuildOutput = buildResult.output;
    logger.logStep(
      buildStepName,
      buildResult.success ? "ok" : "error",
      buildResult.output.slice(0, 200)
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

    if (attempt === maxRepairAttempts) {
      break;
    }

    const repairResult = await logger.timed(
      getRepairStepName(attempt + 1),
      () =>
        stepRepairBuild({
          blueprint,
          buildOutput: buildResult.output,
          generatedFiles: result.generatedFiles,
        }),
      (value) => (value.success ? value.touchedFiles.join(", ") || "repair applied" : value.output)
    );
    await persistJsonArtifact(artifactLogger, getRepairStepName(attempt + 1), "output", repairResult);

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
        getRepairStepName(attempt + 1),
        touchedFile,
        `touched-${touchedFile.replace(/[\\/]+/g, "_")}`
      );
    }
    await autoInstallDependenciesForFiles({
      scope: `repair_${attempt + 1}`,
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

export async function runGenerateProject(
  userInput: string,
  onStep?: (step: BuildStep) => void,
  options?: {
    projectId?: string;
    styleGuide?: string;
    enableSkills?: boolean;
    useDatabasePrompts?: boolean;
    checkpoint?: CheckpointResult;
  }
): Promise<GenerateProjectResult> {
  const flowStart = Date.now();
  const logger = createStepLogger({ onStep, prefix: "generate_project" });
  const artifactLogger = createArtifactLogger("generate_project");
  const result = createInitialResult(logger);
  result.logDirectory = artifactLogger.runDirRelative;

  // Trajectory collector — records conversation history from agent steps
  const { GenerateTrajectoryCollector } = await import("./trajectoryCollector");
  const trajectoryCollector = new GenerateTrajectoryCollector(
    options?.projectId ?? "unknown",
    userInput,
    getModelId()
  );

  // Set section skills toggle — default off, user can enable from UI
  setSectionSkillsEnabled(options?.enableSkills ?? false);

  // When a projectId is provided, point SITE_ROOT at the project directory and
  // skip clearing the template (the project dir was already initialised by the
  // Project_Manager).  Without a projectId we fall back to the existing
  // SITE_ROOT env-var behaviour and run clearTemplate() as before.
  if (options?.projectId) {
    setSiteRoot(projectManagerGetSiteRoot(options.projectId));
  }

  const cp = options?.checkpoint;
  const appScreenFirstEnabled = getPromptProfile() === "app";

  try {
    if (options?.enableSkills) {
      const skillFrontmatterErrors = validateSkillFrontmatter(getSkillPromptsRoot());
      if (skillFrontmatterErrors.length > 0) {
        const detail = skillFrontmatterErrors.map((e) => `${e.fileName}: ${e.message}`).join(" | ");
        logger.logStep("validate_skill_prompts", "error", detail);
        throw new Error(`Invalid skill prompt frontmatter: ${detail}`);
      }
      logger.logStep("validate_skill_prompts", "ok", "all skill frontmatter parsed");
    }

    await persistJsonArtifact(artifactLogger, "run", "input", {
      userInput,
      checkpoint: cp ? { hasCheckpoint: cp.hasCheckpoint, summary: cp.summary } : null,
    });

    if (cp?.hasCheckpoint) {
      logger.logStep("checkpoint_resume", "ok", cp.summary);
    }

    if (!options?.projectId) {
      logger.startStep("clear_template");
      const clearResult = clearTemplate();
      if (clearResult.error) {
        logger.logStep("clear_template", "error", clearResult.error);
      } else {
        logger.logStep(
          "clear_template",
          "ok",
          clearResult.removed.length > 0 ? `${clearResult.removed.length} files removed` : "nothing to clear"
        );
      }
      await persistJsonArtifact(artifactLogger, "clear_template", "output", clearResult);
    }

    // ── Step: analyze_project_requirement ─────────────────────────────────
    let rawBlueprint: ProjectBlueprint;
    let inferredDesignIntentText: string | null = null;

    if (cp?.skipAnalyze && cp.cachedBlueprint) {
      rawBlueprint = cp.cachedBlueprint;
      logger.logStep("analyze_project_requirement", "ok", "resumed from checkpoint");

      if (rawBlueprint.experience?.designIntent?.keywords?.length) {
        logger.logStep("infer_design_intent", "ok", "resumed from checkpoint");
      } else {
        inferredDesignIntentText = await logger.timed(
          "infer_design_intent",
          () => stepInferDesignIntent(userInput),
          (text) => text.slice(0, 80)
        );
        await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntentText, "md");
      }
    } else {
      const analyzePromise = logger.timed(
        "analyze_project_requirement",
        () => stepAnalyzeProjectRequirement(userInput, (name, args, result) => {
          onStep?.({
            step: `tool_call:${name}`,
            status: "ok",
            detail: JSON.stringify({ tool: name, args, result: result.slice(0, 500) }),
            timestamp: Date.now(),
            duration: 0,
          });
        }),
        (blueprint) => `${blueprint.brief.roles.length} roles, ${blueprint.site.pages.length} pages planned`
      );
      const inferPromise = logger.timed(
        "infer_design_intent",
        () => stepInferDesignIntent(userInput),
        (text) => text.slice(0, 80)
      );

      [rawBlueprint, inferredDesignIntentText] = await Promise.all([analyzePromise, inferPromise]);
      await persistJsonArtifact(artifactLogger, "analyze_project_requirement", "output", rawBlueprint);
      await persistTextArtifact(artifactLogger, "infer_design_intent", "output", inferredDesignIntentText, "md");
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

    const normalizedBlueprint = normalizeBlueprint(rawBlueprint);

    // ── Steps: plan_project + match/generate design system ──
    let blueprint: PlannedProjectBlueprint;
    let designSystem: string;

    if (cp?.skipPlanAndDesign && cp.cachedBlueprint && cp.cachedDesignSystem) {
      blueprint = cp.cachedBlueprint;
      designSystem = cp.cachedDesignSystem;
      logger.logStep("plan_project", "ok", "resumed from checkpoint");
      logger.logStep("generate_project_design_system", "ok", "resumed from checkpoint");
    } else {
      logger.startStep("plan_project");
      logger.startStep("match_design_system_skill");

      // Build a fallback markdown text from blueprint's designIntent if inferDesignIntent returned empty
      const designIntentForSystem = inferredDesignIntentText || (() => {
        const di = rawBlueprint.experience?.designIntent;
        if (!di) return "";
        return `## Design Intent\n- Mood: ${di.mood.join(", ")}\n- Color Direction: ${di.colorDirection}\n- Style: ${di.style}\n- Keywords: ${di.keywords.join(", ")}`;
      })();

      // Phase 1: plan_project + skill matching run in parallel
      const [plannedBlueprint, matchResult] = await Promise.all([
        stepPlanProject(normalizedBlueprint).then((bp) => {
          logger.logStep("plan_project", "ok", "section generation plans prepared");
          return bp;
        }),
        stepMatchDesignSystemSkill({
          designIntentText: designIntentForSystem,
          designKeywords: normalizedBlueprint.experience.designIntent.keywords,
          productType: normalizedBlueprint.brief.productScope.productType,
          projectDescription: normalizedBlueprint.brief.projectDescription,
          styleGuide: options?.styleGuide,
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
        }),
      ]);

      blueprint = plannedBlueprint;

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
        designSystem = await stepGenerateProjectDesignSystem(
          designIntentForSystem,
          options?.styleGuide
        );
        logger.logStep("generate_project_design_system", "ok", "design-system.md written");
      }

      // Keep plan_project artifact focused on fields that are actually produced by
      // this step and consumed downstream. Full blueprint is still persisted in
      // final run/result artifacts.
      await persistJsonArtifact(artifactLogger, "plan_project", "output", {
        projectGuardrailIds: blueprint.projectGuardrailIds,
        site: {
          layoutSections: blueprint.site.layoutSections.map((section) => ({
            type: section.type,
            fileName: section.fileName,
          })),
          pages: blueprint.site.pages.map((page) => ({
            slug: page.slug,
            pageDesignPlan: page.pageDesignPlan,
            appScreenPlan: page.appScreenPlan ?? null,
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
    }

    result.blueprint = blueprint;
    const runtimeContext = buildProjectRuntimeContext(blueprint);
    runtimeContext.rawUserInput = userInput;
    appendGeneratedFiles(result, ["design-system.md", "project-plan.json"]);

    // ── Step: apply_project_design_tokens + UI generation (parallel) ──
    const designTokensPromise = (async () => {
      if (cp?.skipDesignTokens) {
        logger.logStep("apply_project_design_tokens", "ok", "resumed from checkpoint");
        return;
      }
      const tokenFiles = await logger.timed(
        "apply_project_design_tokens",
        () => stepApplyProjectDesignTokens(designSystem, (msg) => {
          onStep?.({
            step: "apply_project_design_tokens",
            status: "active",
            detail: msg,
            timestamp: Date.now(),
            duration: 0,
          });
        }),
        (files) => files.join(", ")
      );
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
    })();

    const uiGenerationPromise = (async () => {
      if (appScreenFirstEnabled) {
        const layoutPath = await logger.timed(
          "compose_layout",
          () =>
            ensureAppScreenFirstLayout({
              language: blueprint.brief.language,
              artifactLogger,
            }),
          (path) => path
        );
        appendGeneratedFiles(result, [layoutPath]);

        const pageResult = await generatePages({
          blueprint,
          designSystem,
          runtimeContext,
          artifactLogger,
          logger,
          appScreenFirstEnabled: true,
          skipPages: cp?.composedPages,
          trajectoryCollector,
        });
        appendGeneratedFiles(result, pageResult.files);
        return pageResult.pendingImages;
      }

      const [layoutResult, pageResult] = await Promise.all([
        generateSharedLayoutSections({
          blueprint,
          designSystem,
          runtimeContext,
          artifactLogger,
          logger,
          skipSections: cp?.generatedSections,
          trajectoryCollector,
        }),
        generatePages({
          blueprint,
          designSystem,
          runtimeContext,
          artifactLogger,
          logger,
          appScreenFirstEnabled: false,
          skipSections: cp?.generatedSections,
          skipPages: cp?.composedPages,
          trajectoryCollector,
        }),
      ]);
      appendGeneratedFiles(result, layoutResult.files);
      appendGeneratedFiles(result, pageResult.files);
      return [...layoutResult.pendingImages, ...pageResult.pendingImages];
    })();

    const [, allPendingImages] = await Promise.all([designTokensPromise, uiGenerationPromise]);

    // Await all background image generation before build — images must be on
    // disk for Next.js to bundle them. This runs in parallel with dependency
    // installation since they don't conflict.
    const [imageStats] = await Promise.all([
      awaitPendingImages(allPendingImages),
      autoInstallDependenciesForFiles({
        scope: "generated",
        files: result.generatedFiles,
        artifactLogger,
        result,
        logger,
      }),
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

    // ── Optional pre-build typecheck ──────────────────────────────────────────
    // Running `tsc --noEmit` before `next build` duplicates heavy checks and can
    // significantly slow verification for large section batches. Keep it opt-in.
    const enablePrebuildTypecheck = process.env.ENABLE_PREBUILD_TSC === "1";
    if (enablePrebuildTypecheck) {
      const tscStepName = "typecheck";
      logger.startStep(tscStepName);
      try {
        execSync("npx tsc --noEmit --pretty false 2>&1", {
          cwd: getSiteRoot(),
          encoding: "utf-8",
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        });
        logger.logStep(tscStepName, "ok", "no type errors");
      } catch (err) {
        const tscErrors = (err as { stdout?: string }).stdout?.trim() ?? "";
        const errorCount = (tscErrors.match(/error TS\d+/g) ?? []).length;
        console.warn(`[typecheck] ${errorCount} error(s) found, attempting repair...`);

        const repairResult = await stepRepairBuild({
          blueprint,
          buildOutput: tscErrors,
          generatedFiles: result.generatedFiles,
        });

        if (repairResult.success) {
          appendGeneratedFiles(result, repairResult.touchedFiles);
          logger.logStep(tscStepName, "ok", `${errorCount} error(s) repaired: ${repairResult.touchedFiles.join(", ")}`);
        } else {
          logger.logStep(tscStepName, "error", `${errorCount} error(s), repair failed`);
        }

        await persistJsonArtifact(artifactLogger, tscStepName, "output", {
          errorCount,
          errors: tscErrors.slice(0, 2000),
          repairResult: { success: repairResult.success, touchedFiles: repairResult.touchedFiles },
        });
      }
    } else {
      logger.logStep("typecheck", "ok", "skipped (ENABLE_PREBUILD_TSC!=1)");
    }

    const buildLifecycle = await runBuildWithRepair({ blueprint, artifactLogger, result, logger });
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

  result.totalDuration = Date.now() - flowStart;
  await persistJsonArtifact(artifactLogger, "run", "result", result);
  return result;
}
