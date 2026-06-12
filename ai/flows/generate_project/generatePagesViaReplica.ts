import { formatSiteFile, writeSiteFile } from "./shared/files";
import { buildReplicaPageSource } from "./shared/composeReplicaPage";
import type { PageSpec, PageSpecSection } from "./schema/pageSpec";
import { runSectionReplicaAgent } from "./steps/sectionReplicaAgent";
import type { PageImplementSummary } from "./steps/chromeOptimizeAgent";
import type {
  BuildStep,
  PageAgentProjectContext,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  StepTrace,
} from "./types";
import type { ArtifactLogger, StepLogger } from "./shared/logging";
function getPageImplementAgentStepName(slug: string): string {
  return `page_implement_agent:${slug}`;
}

export interface GeneratePagesViaReplicaParams {
  blueprint: PlannedProjectBlueprint;
  pageSpec: PageSpec;
  designSystem: string;
  runtimeContext: PageAgentProjectContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  skipImplementedPages?: Set<string>;
  onStep?: (step: BuildStep) => void;
}

export interface GeneratePagesViaReplicaResult {
  files: string[];
  pendingImages: never[];
  pageSummaries: PageImplementSummary[];
}

function pageSpecSectionByFileName(
  pageSpec: PageSpec,
  fileName: string
): PageSpecSection | undefined {
  return pageSpec.sections.find((s) => s.fileName === fileName);
}

async function implementPageViaReplica(params: {
  page: PlannedPageBlueprint;
  pageSpec: PageSpec;
  designSystem: string;
  runtimeContext: PageAgentProjectContext;
  artifactLogger: ArtifactLogger;
  logger: StepLogger;
  onStep?: (step: BuildStep) => void;
}): Promise<{
  files: string[];
  pageSummary: PageImplementSummary;
  trace: StepTrace;
}> {
  const { page, pageSpec, designSystem, runtimeContext, artifactLogger, logger, onStep } =
    params;

  if (page.sections.length === 0) {
    throw new Error(
      `generatePagesViaReplica:${page.slug}: no sections — run analyze_screenshot_layout first`
    );
  }

  const sectionOutcomes = await Promise.all(
    page.sections.map(async (section) => {
      const specSection = pageSpecSectionByFileName(pageSpec, section.fileName);
      if (!specSection) {
        throw new Error(
          `generatePagesViaReplica:${page.slug}: missing PageSpec for section "${section.fileName}"`
        );
      }

      const stepName = `section_replica_agent:${page.slug}:${section.fileName}`;
      const outcome = await logger.timed(
        stepName,
        () =>
          runSectionReplicaAgent({
            pageSlug: page.slug,
            section,
            pageSpecSection: specSection,
            designSystem,
            language: runtimeContext.language,
          }),
        (r) => ({ detail: r.summary.slice(0, 200), trace: r.trace })
      );

      await artifactLogger.writeJson(stepName, "output", {
        outputPath: outcome.outputPath,
        summary: outcome.summary,
        toolInvocations: outcome.toolCallRecords,
      });

      return outcome;
    })
  );

  const { pagePath, source } = buildReplicaPageSource({
    slug: page.slug,
    sections: page.sections,
  });
  await writeSiteFile(pagePath, source);
  await formatSiteFile(pagePath);

  const sectionFiles = sectionOutcomes.map((o) => o.outputPath);
  const summary =
    `Screenshot replica: ${page.sections.length} section(s) + composed ${pagePath}. ` +
    sectionOutcomes.map((o) => o.outputPath).join(", ");

  const trace: StepTrace = {
    input: {
      slug: page.slug,
      sectionCount: page.sections.length,
      mode: "screenshot_replica_pipeline",
    },
    output: {
      pagePath,
      sectionFiles,
      summary,
    },
  };

  return {
    files: [...sectionFiles, pagePath],
    pageSummary: {
      slug: page.slug,
      title: page.title,
      summary,
      pagePath,
    },
    trace,
  };
}

export async function generatePagesViaReplica(
  params: GeneratePagesViaReplicaParams
): Promise<GeneratePagesViaReplicaResult> {
  const {
    blueprint,
    pageSpec,
    designSystem,
    runtimeContext,
    artifactLogger,
    logger,
    skipImplementedPages,
    onStep,
  } = params;

  const pageOutcomes = await Promise.all(
    blueprint.site.pages.map(async (page) => {
      const agentStepName = getPageImplementAgentStepName(page.slug);
      const pagePath = buildReplicaPageSource({ slug: page.slug, sections: page.sections })
        .pagePath;

      if (skipImplementedPages?.has(page.slug)) {
        logger.logStep(agentStepName, "ok", "resumed from checkpoint");
        return {
          files: [pagePath],
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
        () =>
          implementPageViaReplica({
            page,
            pageSpec,
            designSystem,
            runtimeContext,
            artifactLogger,
            logger,
            onStep,
          }),
        (r) => ({
          detail: r.pageSummary.summary.slice(0, 260),
          trace: r.trace,
        })
      );

      await artifactLogger.writeJson(agentStepName, "output", {
        pagePath: outcome.pageSummary.pagePath,
        summary: outcome.pageSummary.summary,
        mode: "screenshot_replica_pipeline",
      });

      return {
        files: outcome.files,
        pageSummary: outcome.pageSummary,
      };
    })
  );

  const files: string[] = [];
  const pageSummaries: PageImplementSummary[] = [];
  for (const outcome of pageOutcomes) {
    files.push(...outcome.files);
    pageSummaries.push(outcome.pageSummary);
  }

  return { files, pendingImages: [], pageSummaries };
}
