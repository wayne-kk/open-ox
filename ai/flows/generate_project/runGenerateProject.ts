import { clearTemplate } from "@/lib/clearTemplate";
import { getSiteRoot as projectManagerGetSiteRoot } from "@/lib/projectManager";
import { setSiteRoot } from "@/ai/tools/system/common";
import { isLayoutSection } from "./registry/layoutSections";
import { syncSiteValidationMarkers, readSiteFile } from "./shared/files";
import { createArtifactLogger, createStepLogger } from "./shared/logging";
import { buildSectionFilePath } from "./shared/paths";
import { stepAnalyzeProjectRequirement } from "./steps/analyzeProjectRequirement";
import { stepApplyProjectDesignTokens } from "./steps/applyProjectDesignTokens";
import { stepComposeLayout } from "./steps/composeLayout";
import { stepComposePage } from "./steps/composePage";
import { stepGenerateProjectDesignSystem } from "./steps/generateProjectDesignSystem";
import { stepGenerateSection } from "./steps/generateSection";
import { stepInstallDependencies } from "./steps/installDependencies";
import { stepPlanProject } from "./steps/planProject";
import { stepRepairBuild } from "./steps/repairBuild";
import { stepRunBuild } from "./steps/runBuild";
import type {
  BuildStep,
  GenerateProjectResult,
  PlannedProjectBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
  SectionSpec,
} from "./types";
import type { ArtifactLogger, StepLogger } from "./shared/logging";
import type { GenerateSectionParams } from "./steps/generateSection";

function dedupeSectionsByFileName(sections: SectionSpec[]): SectionSpec[] {
  const seen = new Set<string>();
  return sections.filter((section) => {
    if (seen.has(section.fileName)) {
      return false;
    }

    seen.add(section.fileName);
    return true;
  });
}

function normalizeBlueprint(blueprint: ProjectBlueprint): ProjectBlueprint {
  const layoutSections =
    blueprint.site.layoutSections.length > 0
      ? dedupeSectionsByFileName(blueprint.site.layoutSections)
      : dedupeSectionsByFileName(
          blueprint.site.pages
            .flatMap((page) => page.sections)
            .filter((section) => isLayoutSection(section.type))
        );

  const pages = blueprint.site.pages.map((page) => ({
    ...page,
    sections: page.sections.filter((section) => !isLayoutSection(section.type)),
  }));

  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      layoutSections,
      pages,
    },
  };
}

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
}

function createInitialResult(logger: StepLogger): GenerateProjectResult {
  return {
    success: false,
    verificationStatus: "failed",
    generatedFiles: [],
    unvalidatedFiles: [],
    installedDependencies: [],
    dependencyInstallFailures: [],
    steps: logger.resultSteps,
  };
}

function buildProjectRuntimeContext(blueprint: PlannedProjectBlueprint): ProjectRuntimeContext {
  return {
    projectTitle: blueprint.brief.projectTitle,
    projectDescription: blueprint.brief.projectDescription,
    language: blueprint.brief.language ?? "en",
    productScope: blueprint.brief.productScope,
    roles: blueprint.brief.roles,
    taskLoops: blueprint.brief.taskLoops,
    capabilities: blueprint.brief.capabilities,
    pages: blueprint.site.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      description: page.description,
      journeyStage: page.journeyStage,
    })),
    projectGuardrailIds: blueprint.projectGuardrailIds,
    designKeywords: blueprint.experience.designIntent.keywords ?? [],
  };
}

function appendGeneratedFiles(result: GenerateProjectResult, files: string[]): void {
  for (const path of files) {
    if (!result.generatedFiles.includes(path)) {
      result.generatedFiles.push(path);
    }
  }
}

function appendInstalledDependencies(
  result: GenerateProjectResult,
  dependencies: GenerateProjectResult["installedDependencies"]
): void {
  for (const dependency of dependencies) {
    const existing = result.installedDependencies.find(
      (item) => item.packageName === dependency.packageName && item.dev === dependency.dev
    );

    if (!existing) {
      result.installedDependencies.push({
        ...dependency,
        files: [...dependency.files],
      });
      continue;
    }

    existing.files = Array.from(new Set([...existing.files, ...dependency.files]));
  }
}

function appendDependencyInstallFailures(
  result: GenerateProjectResult,
  failures: GenerateProjectResult["dependencyInstallFailures"]
): void {
  for (const failure of failures) {
    const existing = result.dependencyInstallFailures.find(
      (item) => item.packageName === failure.packageName && item.dev === failure.dev
    );

    if (!existing) {
      result.dependencyInstallFailures.push({
        ...failure,
        files: [...failure.files],
      });
      continue;
    }

    existing.files = Array.from(new Set([...existing.files, ...failure.files]));
    existing.error = failure.error;
  }
}

function getSectionStepName(scopeKey: string, fileName: string): string {
  return `generate_section:${scopeKey}:${fileName}`;
}

function getComposePageStepName(slug: string): string {
  return `compose_page:${slug}`;
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
}): Promise<string[]> {
  const { batchLabel, items, designSystem, runtimeContext, artifactLogger, logger } = params;
  if (items.length === 0) {
    return [];
  }

  items.forEach((item) => logger.startStep(getSectionStepName(item.scopeKey, item.section.fileName)));

  const results = await Promise.allSettled(
    items.map((item) =>
      stepGenerateSection({
        designSystem,
        projectGuardrailIds: runtimeContext.projectGuardrailIds,
        projectContext: runtimeContext,
        section: item.section,
        outputFileRelative: item.outputFileRelative,
        pageContext: item.pageContext,
      })
    )
  );

  const generatedFiles: string[] = [];
  const failures: Array<{ name: string; message: string }> = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const result = results[index];
    const stepName = getSectionStepName(item.scopeKey, item.section.fileName);

    if (result.status === "fulfilled") {
      const { filePath, skillId, trace } = result.value;
      generatedFiles.push(filePath);
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

  return generatedFiles;
}

async function generateSharedLayoutSections(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  result: GenerateProjectResult;
  logger: StepLogger;
}): Promise<void> {
  const { blueprint, designSystem, runtimeContext, artifactLogger, result, logger } = params;
  if (blueprint.site.layoutSections.length === 0) {
    return;
  }

  const generatedFiles = await runSectionBatch({
    batchLabel: "layout",
    items: blueprint.site.layoutSections.map((section) => ({
      scopeKey: "layout",
      section,
      outputFileRelative: buildSectionFilePath("layout", section.fileName),
    })),
    designSystem,
    runtimeContext,
    artifactLogger,
    logger,
  });
  appendGeneratedFiles(result, generatedFiles);

  const layoutPath = await logger.timed(
    "compose_layout",
    () => stepComposeLayout(blueprint.site.layoutSections, blueprint),
    (path) => path ?? "layout unchanged"
  );
  if (layoutPath) {
    appendGeneratedFiles(result, [layoutPath]);
    await persistJsonArtifact(artifactLogger, "compose_layout", "output", {
      layoutPath,
      layoutSections: blueprint.site.layoutSections.map((section) => section.fileName),
    });
    await persistSiteFileArtifact(artifactLogger, "compose_layout", layoutPath, "layout");
  }
}

async function generatePages(params: {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  runtimeContext: ProjectRuntimeContext;
  artifactLogger: ArtifactLogger;
  result: GenerateProjectResult;
  logger: StepLogger;
}): Promise<void> {
  const { blueprint, designSystem, runtimeContext, artifactLogger, result, logger } = params;

  // Pages are independent (distinct output paths per slug); run in parallel for wall-clock time.
  const pageOutcomes = await Promise.all(
    blueprint.site.pages.map(async (page) => {
      const generatedFiles = await runSectionBatch({
        batchLabel: `page ${page.slug}`,
        items: page.sections.map((section) => ({
          scopeKey: page.slug,
          section,
          outputFileRelative: buildSectionFilePath(page.slug, section.fileName),
          pageContext: {
            title: page.title,
            slug: page.slug,
            description: page.description,
            journeyStage: page.journeyStage,
            primaryRoleIds: page.primaryRoleIds,
            supportingCapabilityIds: page.supportingCapabilityIds,
            pageDesignPlan: page.pageDesignPlan,
          },
        })),
        designSystem,
        runtimeContext,
        artifactLogger,
        logger,
      });

      const pagePath = await logger.timed(
        getComposePageStepName(page.slug),
        () => stepComposePage(page, designSystem, page.sections),
        (path) => path
      );

      await persistJsonArtifact(artifactLogger, getComposePageStepName(page.slug), "output", {
        pagePath,
        slug: page.slug,
        title: page.title,
        sections: page.sections.map((section) => section.fileName),
      });
      await persistSiteFileArtifact(
        artifactLogger,
        getComposePageStepName(page.slug),
        pagePath,
        "page"
      );

      return { generatedFiles, pagePath };
    })
  );

  for (const { generatedFiles, pagePath } of pageOutcomes) {
    appendGeneratedFiles(result, generatedFiles);
    appendGeneratedFiles(result, [pagePath]);
  }
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
  options?: { projectId?: string }
): Promise<GenerateProjectResult> {
  const flowStart = Date.now();
  const logger = createStepLogger({ onStep, prefix: "generate_project" });
  const artifactLogger = createArtifactLogger("generate_project");
  const result = createInitialResult(logger);
  result.logDirectory = artifactLogger.runDirRelative;

  // When a projectId is provided, point SITE_ROOT at the project directory and
  // skip clearing the template (the project dir was already initialised by the
  // Project_Manager).  Without a projectId we fall back to the existing
  // SITE_ROOT env-var behaviour and run clearTemplate() as before.
  if (options?.projectId) {
    setSiteRoot(projectManagerGetSiteRoot(options.projectId));
  }

  try {
    await persistJsonArtifact(artifactLogger, "run", "input", { userInput });

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

    const rawBlueprint = await logger.timed(
      "analyze_project_requirement",
      () => stepAnalyzeProjectRequirement(userInput, (name, args, result) => {
        // Stream tool calls to the UI in real-time
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
    await persistJsonArtifact(artifactLogger, "analyze_project_requirement", "output", rawBlueprint);
    const normalizedBlueprint = normalizeBlueprint(rawBlueprint);
    const blueprint = await logger.timed(
      "plan_project",
      () => stepPlanProject(normalizedBlueprint),
      () => "section generation plans prepared"
    );
    await persistJsonArtifact(artifactLogger, "plan_project", "output", blueprint);

    // Safety: move any non-layout sections that planProject mistakenly put in layoutSections
    // back to the home page's sections array
    const trueLayoutSections = blueprint.site.layoutSections.filter((s) => isLayoutSection(s.type));
    const misplacedSections = blueprint.site.layoutSections.filter((s) => !isLayoutSection(s.type));
    if (misplacedSections.length > 0) {
      console.warn(`[plan_project] ${misplacedSections.length} non-layout sections found in layoutSections, moving to home page`);
      blueprint.site.layoutSections = trueLayoutSections;
      const homePage = blueprint.site.pages.find((p) => p.slug === "home") ?? blueprint.site.pages[0];
      if (homePage) {
        homePage.sections = [...misplacedSections, ...homePage.sections];
      }
    }

    result.blueprint = blueprint;
    const runtimeContext = buildProjectRuntimeContext(blueprint);

    const designSystem = await logger.timed(
      "generate_project_design_system",
      () => stepGenerateProjectDesignSystem(blueprint),
      () => "design-system.md written"
    );
    await persistTextArtifact(
      artifactLogger,
      "generate_project_design_system",
      "design-system",
      designSystem,
      "md"
    );
    appendGeneratedFiles(result, ["design-system.md"]);

    const tokenFiles = await logger.timed(
      "apply_project_design_tokens",
      () => stepApplyProjectDesignTokens(designSystem),
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

    await generateSharedLayoutSections({
      blueprint,
      designSystem,
      runtimeContext,
      artifactLogger,
      result,
      logger,
    });
    await generatePages({
      blueprint,
      designSystem,
      runtimeContext,
      artifactLogger,
      result,
      logger,
    });
    await autoInstallDependenciesForFiles({
      scope: "generated",
      files: result.generatedFiles,
      artifactLogger,
      result,
      logger,
    });
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
