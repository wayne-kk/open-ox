/**
 * Per-route UI via multi-turn system tools (Cursor-style), without a fixed section manifest.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  composePromptBlocks,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { lfPageImplementPhaseSlug } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { createImageExecutor } from "@/ai/tools/system/generateImageTool";
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
  fileSessionTools,
  type FileSessionCall,
  type FileSessionWorkspace,
} from "@/ai/shared/fileSession/fileSession";
import { SiteFileSessionWorkspace } from "@/ai/shared/fileSession/siteFileSessionWorkspace";

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
    maxFiles: 8,
    maxMutationsPerFile: 4,
    maxConsecutiveFailuresPerFile: 2,
  });
}

const VISIBLE_TOOL_NAMES = new Set(["create_file", "apply_file_patch"]);

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

  const fileSession = createPageFileSession({
    slug: page.slug,
    targetPath,
    componentRoot,
    workspace: new SiteFileSessionWorkspace(),
  });

  const pageImageScope = `page-${componentRoot.slice("components/pages/".length)}`;
  const { executor: baseImageExecutor, pendingImages } = createImageExecutor(
    pageImageScope,
    {
      filenamePrefix: pageImageScope,
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

  const fullPageTools: ChatCompletionTool[] = [
    ...fileSessionTools,
    ...(imageTool ? [imageTool] : []),
  ];
  const maxIterations = resolvePageAgentMaxIterations();
  let emptyStopRecoveries = 0;
  let iterationsUsed = 0;

  const executeFileCommand = async (
    name: FileSessionCall["name"],
    args: Record<string, unknown>,
  ): Promise<ToolResult> => {
    const event = await fileSession.execute({ name, args } as FileSessionCall);
    return event.success
      ? {
          success: true,
          output: JSON.stringify(event),
          meta: {
            path: event.path,
            revision: event.revision,
            eventKind: event.kind,
            cached: event.cached,
          },
        }
      : { success: false, error: `${event.code}: ${event.error}` };
  };

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: fullPageTools,
    temperature: 0.5,
    maxIterations,
    completionProfile: "code",
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      create_file: (args) => executeFileCommand("create_file", args),
      read_file_snapshot: (args) => executeFileCommand("read_file_snapshot", args),
      apply_file_patch: (args) => executeFileCommand("apply_file_patch", args),
      verify_files: (args) => executeFileCommand("verify_files", args),
      generate_image: imageExecutor,
    },
    resolveToolsForIteration: (_iteration, defaults) => {
      const legalFileToolNames = new Set(
        fileSession.tools().map((tool) => tool.function?.name),
      );
      return defaults.filter(
        (tool) =>
          tool.function?.name === "generate_image" ||
          legalFileToolNames.has(tool.function?.name),
      );
    },
    resolveToolChoiceForIteration: () =>
      fileSession.stopDecision().kind === "complete" ? "auto" : "required",
    onMessage,
    onAssistantRound: ({ iteration }) => {
      iterationsUsed = Math.max(iterationsUsed, iteration + 1);
    },
    onAssistantStop: ({ messages: msgs }) => {
      const decision = fileSession.stopDecision();
      if (decision.kind === "complete" || emptyStopRecoveries >= 2) return false;
      emptyStopRecoveries += 1;
      const nudge: ChatMessage = {
        role: "system",
        content:
          `[File session recovery ${emptyStopRecoveries}/2] ${decision.kind === "continue" ? decision.reason : decision.error}. ` +
          `Use create_file for a missing path, or read_file_snapshot then apply_file_patch for an existing path.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
      return true;
    },
    shouldAbortAfterToolResults: () => fileSession.stopDecision().kind !== "continue",
    requireTools: true,
    onToolCall: ({ name, args, iteration, result }) => {
      if (!onStep) return;
      const cached = typeof result === "object" && result.meta?.cached === true;
      if (VISIBLE_TOOL_NAMES.has(name) && !cached) {
        const filePath = String(args.path ?? "");
        const succeeded = typeof result === "string" || result.success;
        onStep({
          step: `page_agent_file:${page.slug}:${filePath}`,
          status: succeeded ? "ok" : "error",
          detail: succeeded
            ? `[${page.slug}] ${name.replace("_", " ")}: ${filePath}`
            : `[${page.slug}] ${name.replace("_", " ")} rejected: ${filePath}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
      const detail =
        name === "read_file_snapshot"
          ? `reading ${
              String(args.path ?? "")
                .split("/")
                .pop() || "..."
            }`
          : name === "create_file" || name === "apply_file_patch"
            ? `writing ${
                String(args.path ?? "")
                  .split("/")
                  .pop() || "..."
              }`
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
    onApproachingLimit: ({ messages: msgs }) => {
      const nudge: ChatMessage = {
        role: "system",
        content:
          `[Iteration Budget] You have used most of your available tool-calling rounds. ` +
          `Wrap up now:\n` +
          `Ensure \`${targetPath}\` is implemented and clean. Use verify_files; completion is automatic. ` +
          `Do not start new files or features.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: lfPageImplementPhaseSlug(page.slug),
  });

  const finalDecision = fileSession.stopDecision();
  if (finalDecision.kind !== "complete") {
    throw new Error(
      `page_implement_agent:${page.slug}: stopped after ${iterationsUsed}/${maxIterations} iterations ` +
        `without completing ${targetPath}: ${finalDecision.kind === "continue" ? finalDecision.reason : finalDecision.error}. ` +
        `Successful target write: ${fileSession.writtenPaths().includes(targetPath) ? "yes" : "no"}. ` +
        `Empty-stop recoveries: ${emptyStopRecoveries}/2. Model: ${model}, ` +
        `tool calls: ${toolCalls.length}. Last message: ${(content || "(empty)").slice(0, 300)}`,
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
  const writtenPaths = fileSession.writtenPaths();

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
    summary: completeSummary || content.slice(0, 500) || "ok",
    toolCallRecords: toolCalls.length,
  };
}
