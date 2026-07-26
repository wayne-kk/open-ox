/**
 * Per-route UI via multi-turn system tools (Cursor-style), without a fixed section manifest.
 */
import {
  composePromptBlocks,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { lfPageImplementPhaseSlug } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { createRequiredImageExecutor } from "@/ai/tools/system/generateImageTool";
import type { PendingImage } from "@/ai/tools/system/generateImageTool";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { slugToPageComponentRoot, slugToPagePath } from "../shared/paths";
import type {
  PlannedPageBlueprint,
  StepTrace,
  PageAgentProjectContext,
  BuildStep,
} from "../types";
import { resolvePageImplementAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
import { screenshotGuardrailIdFromContext } from "../shared/screenshotIntentMode";
import {
  shouldBlockSkillsForScreenshotReplicate,
  shouldScanPromptForUserImageUrls,
} from "../shared/screenshotReplicaPipeline";
import { hasUserProvidedContent } from "../schema/normalizeUserProvidedContent";
import {
  prepareUserProvidedContentForPageAgent,
  userProvidedContentFileHint,
  userProvidedContentImagesBlock,
} from "../shared/userProvidedContentContext";
import {
  buildGenerateImageToolForPageAgent,
  guardGenerateImageExecutor,
  listUserProvidedImageUrls,
} from "../shared/userProvidedImageEnforcement";
import { buildPageAgentUserMessage } from "../shared/pageAgentBrief";
import {
  buildPageAgentBootstrap,
  isPageAgentBootstrapEnabled,
} from "../shared/pageAgentBootstrap";
import { resolvePageAgentMaxIterations } from "../shared/pageAgentToolLoop";
import {
  createFileSession,
  type FileSessionWorkspace,
} from "@/ai/shared/fileSession/fileSession";
import { SiteFileSessionWorkspace } from "@/ai/shared/fileSession/siteFileSessionWorkspace";
import { getSiteRoot } from "@/ai/tools/system/common";
import {
  createPageImageAssetSession,
  createPublicImageAssetExists,
} from "../shared/pageImageCompletionPolicy";
import { runPageBuildSession } from "../pageBuildSession/pageBuildSession";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

function assertDefaultExportPage(tsx: string, path: string): void {
  if (
    !/export\s+default\s+function\b/.test(tsx) &&
    !/export\s+default\s+\w+/.test(tsx)
  ) {
    throw new Error(
      `page_implement_agent: ${path} must include a default export`,
    );
  }
}

export function pageImplementationIncompleteReason(
  tsx: string,
  path: string,
): string | null {
  if (!tsx.trim()) return `${path} is empty or missing`;
  if (
    !/export\s+default\s+function\b/.test(tsx) &&
    !/export\s+default\s+\w+/.test(tsx)
  ) {
    return `${path} must include a default export`;
  }
  if (tsx.includes("Preparing your site")) {
    return `${path} is still the default stub (\"Preparing your site…\")`;
  }
  return null;
}

export function isPageImplementationValid(tsx: string, path: string): boolean {
  return pageImplementationIncompleteReason(tsx, path) === null;
}

export function pageImplementationRequiresToolCall(tsx: string, path: string): boolean {
  return !isPageImplementationValid(tsx, path);
}

export function createPageFileSession(options: {
  slug: string;
  targetPath: string;
  componentRoot: string;
  workspace: FileSessionWorkspace;
  validateCompletion?: NonNullable<Parameters<typeof createFileSession>[0]["validateCompletion"]>;
}) {
  const { slug, targetPath, componentRoot, workspace } = options;
  return createFileSession({
    owner: `page:${slug}`,
    workspace,
    ownsPath: (path) => path === targetPath || path.startsWith(`${componentRoot}/`),
    requiredArtifacts: [targetPath],
    replaceableBaselinePaths: [targetPath],
    validateArtifact: (path, content) =>
      pageImplementationIncompleteReason(content, path),
    validateCompletion: options.validateCompletion,
    maxFiles: 8,
    maxConsecutiveFailuresPerFile: 2,
  });
}

export interface RunPageImplementAgentParams {
  page: PlannedPageBlueprint;
  designSystem: string;
  projectContext: PageAgentProjectContext;
  onMessage?: (msg: ChatMessage) => void;
  /** Emit build sub-steps for UI progress visibility (topology + conversation). */
  onStep?: (step: BuildStep) => void;
}

export interface PageImplementAgentResult {
  pagePath: string;
  /** All paths the agent wrote/edited (page + extracted components). */
  writtenPaths: string[];
  trace: StepTrace;
  pendingImages: PendingImage[];
  /** Every required generation attempt, including failures later retried successfully. */
  imageAttempts: PendingImage[];
  summary: string;
  toolCallRecords: number;
}

export async function runPageImplementAgent(
  params: RunPageImplementAgentParams,
): Promise<PageImplementAgentResult> {
  const { page, projectContext, onMessage, onStep } = params;
  const targetPath = slugToPagePath(page.slug);
  const componentRoot = slugToPageComponentRoot(page.slug);
  const model = getModelForStep("page_implement_agent");
  const thinking = getThinkingLevelForStep("page_implement_agent");
  const agentStepName = `page_implement_agent:${page.slug}`;
  const userContent = prepareUserProvidedContentForPageAgent(
    projectContext.userProvidedContent,
  );
  const hasRefShot = Boolean(projectContext.referenceScreenshotDataUrl?.trim());
  const imageUrlFallbackText = shouldScanPromptForUserImageUrls(
    projectContext.screenshotIntentMode ?? "none",
    hasRefShot,
    projectContext.rawUserInput,
  )
    ? (projectContext.rawUserInput ?? "")
    : "";
  const userImageUrls = listUserProvidedImageUrls(
    userContent,
    imageUrlFallbackText,
  );
  const userImageCount = userImageUrls.length;
  const hasUserContent = hasUserProvidedContent(userContent);
  const refShot = projectContext.referenceScreenshotDataUrl ?? null;
  const replicateLayout =
    projectContext.pages.length === 1 &&
    shouldBlockSkillsForScreenshotReplicate(
      projectContext.screenshotIntentMode ?? "none",
      Boolean(refShot?.trim()),
      projectContext.rawUserInput,
    );

  const planJson = JSON.stringify(
    {
      pageGoal: page.pageDesignPlan.pageGoal,
      narrativeArc: page.pageDesignPlan.narrativeArc,
      layoutStrategy: page.pageDesignPlan.layoutStrategy,
      hierarchy: page.pageDesignPlan.hierarchy,
      constraints: page.pageDesignPlan.constraints,
    },
    null,
    2,
  );

  const userMessage = buildPageAgentUserMessage({
    targetPath,
    slug: page.slug,
    pageTitle: page.title,
    pageDescription: page.description,
    journeyStage: page.journeyStage,
    planJson,
    projectTitle: projectContext.projectTitle,
    projectDescription: projectContext.projectDescription,
    language: projectContext.language,
    designKeywords: projectContext.designKeywords,
    userProvidedFileHint: userProvidedContentFileHint(hasUserContent),
    userProvidedImagesBlock: userProvidedContentImagesBlock(userContent),
    userImageCount,
    screenshotReplicaLayout: replicateLayout,
  });

  const refGuardId = screenshotGuardrailIdFromContext(
    projectContext.screenshotIntentMode,
    Boolean(refShot?.trim()),
  );
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("pageImplementAgent"),
    ...(refGuardId ? [loadGuardrail(refGuardId)] : []),
    ...(replicateLayout
      ? [
          loadGuardrail("screenshotReplicateNoUserAssets"),
          loadGuardrail("screenshotReplicatePageOwnsChrome"),
        ]
      : [loadGuardrail("chromeDeferredNoPageNav")]),
    ...resolvePageImplementAgentRuleIds({
      userProvidedImageCount: userImageCount,
    }).map(loadGuardrail),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserVisionContent(userMessage, refShot),
    },
  ];

  const bootstrapEnabled = isPageAgentBootstrapEnabled();
  if (bootstrapEnabled) {
    const bootstrap = buildPageAgentBootstrap({
      hasUserProvidedContent: hasUserContent,
      designSystem: params.designSystem,
    });
    messages.push({ role: "user", content: bootstrap.message });
  }

  const imageAssets = createPageImageAssetSession({
    allowedRemoteUrls: userImageUrls,
    assetExists: createPublicImageAssetExists(getSiteRoot()),
  });
  const fileSession = createPageFileSession({
    slug: page.slug,
    targetPath,
    componentRoot,
    workspace: new SiteFileSessionWorkspace(),
  });

  const pageImageScope = `page-${componentRoot.slice("components/pages/".length)}`;
  const {
    executor: baseImageExecutor,
    generatedImages: pendingImages,
    attempts: imageAttempts,
  } = createRequiredImageExecutor(
    pageImageScope,
    {
      onGeneratedAsset: (asset) => imageAssets.recordGeneratedAsset(asset.publicPath),
    },
  );
  const imageExecutor = guardGenerateImageExecutor(
    baseImageExecutor,
    userImageUrls,
  );

  const imageTool =
    userImageCount > 0
      ? buildGenerateImageToolForPageAgent(userImageCount)
      : getSystemToolDefinitions(["generate_image"])[0];

  const maxIterations = resolvePageAgentMaxIterations();
  const build = await runPageBuildSession({
    slug: page.slug,
    targetPath,
    componentRoot,
    initialMessages: messages,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    fileSession,
    isPrimaryArtifactValid: (content) =>
      pageImplementationIncompleteReason(content, targetPath) === null,
    assetLifecycle: {
      inspect: imageAssets.inspect,
      ...(imageTool ? { generation: { tool: imageTool, execute: imageExecutor } } : {}),
    },
    onEvent: (event) => {
      if (event.kind === "message") {
        onMessage?.(event.message);
        return;
      }
      if (event.kind !== "tool" || !onStep) return;
      const { name, iteration, result, activity, path: eventPath } = event;
      if (!onStep) return;
      const cached = typeof result === "object" && result.meta?.cached === true;
      if (activity === "write" && eventPath && !cached) {
        const succeeded = typeof result === "string" || result.success;
        const retryable = typeof result === "object" && result.meta?.retryable === true;
        onStep({
          step: `page_agent_file:${page.slug}:${eventPath}`,
          status: succeeded ? "ok" : retryable ? "active" : "error",
          detail: succeeded
            ? `[${page.slug}] ${name.replace("_", " ")}: ${eventPath}`
            : `[${page.slug}] ${name.replace("_", " ")} rejected: ${eventPath}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
      const detail = activity === "read" || activity === "write"
        ? `${activity === "read" ? "reading" : "writing"} ${eventPath?.split("/").pop() || "..."}`
        : undefined;
      if (detail) {
        onStep({
          step: agentStepName,
          status: "active",
          detail: `[iter ${iteration + 1}/${maxIterations}] ${detail}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
    },
    langfusePhase: lfPageImplementPhaseSlug(page.slug),
  });
  const {
    content,
    toolCalls,
    iterationsUsed,
    emptyStopRecoveries,
    finalDecision,
    finalRequirement,
    finalLegalTools,
    deterministicRecoveries,
  } = build;

  if (finalDecision.kind !== "complete") {
    throw new Error(
      `page_implement_agent:${page.slug}: stopped after ${iterationsUsed}/${maxIterations} iterations ` +
        `without completing ${targetPath}: ${finalDecision.kind === "continue" ? finalDecision.reason : finalDecision.error}. ` +
        `Successful target write: ${fileSession.snapshot().writtenPaths.includes(targetPath) ? "yes" : "no"}. ` +
        `Requirement: ${finalRequirement ? JSON.stringify(finalRequirement) : "none"}. ` +
        `Legal tools: ${finalLegalTools.join(",") || "none"}. ` +
        `Deterministic recoveries: ${deterministicRecoveries}. ` +
        `Empty-stop recoveries: ${emptyStopRecoveries}/2. Model: ${model}, ` +
        `tool calls: ${toolCalls.length}. Last message: ${content ? "non-empty" : "empty"}`,
    );
  }
  const completeSummary = content || `Page output contract satisfied at ${targetPath}`;

  const tsx = readSiteFile(targetPath);
  if (!tsx) {
    throw new Error(
      `page_implement_agent:${page.slug}: ${targetPath} is empty or missing ` +
        `after agent signaled completion`,
    );
  }
  assertDefaultExportPage(tsx, targetPath);
  if (tsx.includes("Preparing your site")) {
    throw new Error(
      `page_implement_agent:${page.slug}: ${targetPath} is still the default stub ` +
        `("Preparing your site…") after the agent signaled completion`,
    );
  }
  const writtenPaths = [...fileSession.snapshot().writtenPaths];

  const trace: StepTrace = {
    input: {
      slug: page.slug,
      targetPath,
      pageDesignPlan: page.pageDesignPlan,
    },
    output: {
      completeSummary,
      assistantTail: truncate(content, 2000),
      toolInvocations: toolCalls.length,
      imageAttempts: imageAttempts.map(({ filename, publicPath, success, error, durationMs }) => ({
        filename,
        publicPath,
        success,
        error,
        durationMs,
      })),
    },
    llmCall: {
      model,
      thinkingLevel: thinking,
      systemPrompt: truncate(systemPrompt, 4000),
      userMessage: truncate(userMessage, 4000),
      rawResponse: truncate(content, 8000),
    },
  };

  return {
    pagePath: targetPath,
    writtenPaths,
    trace,
    pendingImages,
    imageAttempts,
    summary: completeSummary || content.slice(0, 500) || "ok",
    toolCallRecords: toolCalls.length,
  };
}
