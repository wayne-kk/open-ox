/**
 * Per-route UI via multi-turn system tools (Cursor-style), without a fixed section manifest.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  composePromptBlocks,
  formatSiteFile,
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
import { slugToPagePath } from "../shared/paths";
import type { PlannedPageBlueprint, StepTrace, PageAgentProjectContext, BuildStep } from "../types";
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
import {
  compactPageAgentMessages,
  createBootstrapGuardedListDirExecutor,
  createBootstrapGuardedReadExecutor,
  createPageAgentChromeDeferredWriteExecutor,
  createPageAgentSessionState,
  executePageAgentListDir,
  executePageAgentReadFile,
  filterPageAgentToolsForPhase,
  formatPageAgentToolResultForModel,
  isPageAgentBatchFirstRoundEnabled,
  pageAgentCompactFromIteration,
  recordPageAgentToolCall,
  resolvePageAgentMaxIterations,
  shouldRunPageAgentCompaction,
} from "../shared/pageAgentToolLoop";

export const PAGE_IMPLEMENTATION_COMPLETE = "page_implementation_complete";

/** S3 — format_code removed; write/edit auto-format on save. */
const TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "search_code",
  "read_lints",
  "think",
  "generate_image",
  "exec_shell",
  "install_package",
  "revert_file",
] as const;

const completeTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: PAGE_IMPLEMENTATION_COMPLETE,
    description:
      "MANDATORY — call this tool exactly once as your final action after the page " +
      "is fully implemented. Preconditions: page.tsx exists with a default export, " +
      "extracted components live under components/, and imports resolve. " +
      "After you call this, the global pipeline runs a production build — do NOT skip this tool.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Brief summary: list files created/changed and describe the layout approach (1-3 sentences).",
        },
      },
      required: ["summary"],
    },
  },
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[truncated]`;
}

function assertDefaultExportPage(tsx: string, path: string): void {
  if (!/export\s+default\s+function\b/.test(tsx) && !/export\s+default\s+\w+/.test(tsx)) {
    throw new Error(`page_implement_agent: ${path} must include a default export`);
  }
}

/** Tools whose execution should be surfaced as individual sub-steps in the build conversation. */
const VISIBLE_TOOL_NAMES = new Set(["write_file", "edit_file", "install_package"]);

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
  params: RunPageImplementAgentParams
): Promise<PageImplementAgentResult> {
  const {
    page,
    projectContext,
    onMessage,
    onStep,
  } = params;
  const targetPath = slugToPagePath(page.slug);
  const model = getModelForStep("page_implement_agent");
  const thinking = getThinkingLevelForStep("page_implement_agent");
  const agentStepName = `page_implement_agent:${page.slug}`;
  const userContent = prepareUserProvidedContentForPageAgent(projectContext.userProvidedContent);
  const hasRefShot = Boolean(projectContext.referenceScreenshotDataUrl?.trim());
  const imageUrlFallbackText = shouldScanPromptForUserImageUrls(
    projectContext.screenshotIntentMode ?? "none",
    hasRefShot,
    projectContext.rawUserInput
  )
    ? (projectContext.rawUserInput ?? "")
    : "";
  const userImageUrls = listUserProvidedImageUrls(userContent, imageUrlFallbackText);
  const userImageCount = userImageUrls.length;
  const hasUserContent = hasUserProvidedContent(userContent);

  const planJson = JSON.stringify(
    {
      pageGoal: page.pageDesignPlan.pageGoal,
      narrativeArc: page.pageDesignPlan.narrativeArc,
      layoutStrategy: page.pageDesignPlan.layoutStrategy,
      hierarchy: page.pageDesignPlan.hierarchy,
      constraints: page.pageDesignPlan.constraints,
    },
    null,
    2
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
    completeToolName: PAGE_IMPLEMENTATION_COMPLETE,
    screenshotReplicaLayout: shouldBlockSkillsForScreenshotReplicate(
      projectContext.screenshotIntentMode ?? "none",
      Boolean(projectContext.referenceScreenshotDataUrl?.trim()),
      projectContext.rawUserInput
    ),
  });

  const refShot = projectContext.referenceScreenshotDataUrl ?? null;
  const refGuardId = screenshotGuardrailIdFromContext(
    projectContext.screenshotIntentMode,
    Boolean(refShot?.trim())
  );
  const replicateLayout = shouldBlockSkillsForScreenshotReplicate(
    projectContext.screenshotIntentMode ?? "none",
    Boolean(refShot?.trim()),
    projectContext.rawUserInput
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
    ...resolvePageImplementAgentRuleIds({ userProvidedImageCount: userImageCount }).map(
      loadGuardrail
    ),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserVisionContent(userMessage, refShot),
    },
  ];

  const bootstrapEnabled = isPageAgentBootstrapEnabled();
  let bootstrappedPaths = new Set<string>();
  let bootstrapSummary = "";
  if (bootstrapEnabled) {
    const bootstrap = buildPageAgentBootstrap({
      hasUserProvidedContent: hasUserContent,
      designSystem: params.designSystem,
    });
    bootstrappedPaths = bootstrap.bootstrappedPaths;
    bootstrapSummary = bootstrap.compactSummary;
    messages.push({ role: "user", content: bootstrap.message });
  }

  const readFileExecutor = bootstrapEnabled
    ? createBootstrapGuardedReadExecutor(bootstrappedPaths)
    : executePageAgentReadFile;
  const listDirExecutor = bootstrapEnabled
    ? createBootstrapGuardedListDirExecutor(bootstrappedPaths)
    : executePageAgentListDir;
  const chromeDeferredWrites = !replicateLayout;
  const writeFileExecutor = chromeDeferredWrites
    ? createPageAgentChromeDeferredWriteExecutor("write_file")
    : undefined;
  const editFileExecutor = chromeDeferredWrites
    ? createPageAgentChromeDeferredWriteExecutor("edit_file")
    : undefined;

  const { executor: baseImageExecutor, pendingImages } = createImageExecutor(
    `page-${page.slug.replace(/[^a-zA-Z0-9_-]+/g, "-")}`
  );
  const imageExecutor = guardGenerateImageExecutor(baseImageExecutor, userImageUrls);

  const imageTool =
    userImageCount > 0
      ? buildGenerateImageToolForPageAgent(userImageCount)
      : getSystemToolDefinitions(["generate_image"])[0];

  const fullPageTools: ChatCompletionTool[] = [
    ...getSystemToolDefinitions(
      TOOL_NAMES.filter((name) => name !== "generate_image")
    ),
    ...(imageTool ? [imageTool] : []),
    completeTool,
  ];

  const batchFirstRound = isPageAgentBatchFirstRoundEnabled();
  const batchWriteTools: ChatCompletionTool[] = [
    ...getSystemToolDefinitions(["read_file", "list_dir", "write_file"]),
    ...(imageTool ? [imageTool] : []),
  ];

  let implementationComplete = false;
  let completeSummary = "";
  const sessionState = createPageAgentSessionState(bootstrapSummary);
  const compactFromIter = pageAgentCompactFromIteration();
  const maxIterations = resolvePageAgentMaxIterations();
  const preserveHeadCount = bootstrapEnabled ? 3 : 2;

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: fullPageTools,
    temperature: 0.5,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      read_file: readFileExecutor,
      list_dir: listDirExecutor,
      ...(writeFileExecutor ? { write_file: writeFileExecutor } : {}),
      ...(editFileExecutor ? { edit_file: editFileExecutor } : {}),
      [PAGE_IMPLEMENTATION_COMPLETE]: async (
        args: Record<string, unknown>
      ): Promise<ToolResult> => {
        implementationComplete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        return { success: true, output: "page_implementation_complete acknowledged" };
      },
      generate_image: imageExecutor,
    },
    formatToolResultForModel: formatPageAgentToolResultForModel,
    compactMessagesBeforeRound: ({ iteration, messages: msgs }) => {
      if (
        bootstrapEnabled &&
        !sessionState.actNudgeSent &&
        iteration >= 2 &&
        sessionState.writtenPaths.length === 0
      ) {
        const nudge: ChatMessage = {
          role: "system",
          content:
            `[Act mode] Workspace bootstrap is already in context. Stop read/list — ` +
            `\`write_file\` \`${targetPath}\` and page components, then \`${PAGE_IMPLEMENTATION_COMPLETE}\`.`,
        };
        msgs.push(nudge);
        sessionState.actNudgeSent = true;
        onMessage?.(nudge);
      }
      if (
        shouldRunPageAgentCompaction(sessionState, iteration, compactFromIter)
      ) {
        compactPageAgentMessages(msgs, sessionState, {
          bootstrapSummary,
          preserveHeadCount,
        });
      }
    },
    resolveToolsForIteration: (iteration, defaults) => {
      const allowObserve = sessionState.allowObserveTools || !bootstrapEnabled;
      let toolsForRound = filterPageAgentToolsForPhase(defaults, allowObserve);

      if (
        bootstrapEnabled &&
        iteration === 0 &&
        sessionState.writtenPaths.length === 0
      ) {
        toolsForRound = toolsForRound.filter((t) => {
          const n = t.function?.name;
          return (
            n === "write_file" ||
            n === "edit_file" ||
            n === "generate_image" ||
            n === PAGE_IMPLEMENTATION_COMPLETE
          );
        });
      }

      if (batchFirstRound && iteration === 0) {
        toolsForRound = filterPageAgentToolsForPhase(batchWriteTools, allowObserve);
      }
      return toolsForRound;
    },
    resolveToolChoiceForIteration: (iteration, toolsForRound) => {
      if (batchFirstRound && iteration === 0 && toolsForRound.length > 0) {
        return "required";
      }
      if (
        bootstrapEnabled &&
        iteration === 0 &&
        toolsForRound.some((t) => t.function?.name === "write_file")
      ) {
        return "required";
      }
      return "auto";
    },
    onMessage,
    shouldAbortAfterToolResults: () => implementationComplete,
    requireTools: true,
    onToolCall: ({ name, args, iteration, result }) => {
      recordPageAgentToolCall(sessionState, name, args);

      if (name === "read_lints" && typeof result === "object") {
        const errN = Number(result.meta?.verifyErrorCount ?? 0);
        if (errN > 0 || (result.diagnostics?.length ?? 0) > 0) {
          sessionState.allowObserveTools = true;
        }
      }

      if (!onStep) return;
      if (VISIBLE_TOOL_NAMES.has(name)) {
        const filePath = String(args.path ?? "");
        onStep({
          step: `page_agent_tool:${page.slug}:${name}:${iteration}`,
          status: "ok",
          detail: `${name.replace("_", " ")}: ${filePath}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
      const detail =
        name === "read_file" || name === "list_dir"
          ? `reading ${String(args.path ?? "").split("/").pop() || "..."}`
          : name === "write_file" || name === "edit_file"
            ? `writing ${String(args.path ?? "").split("/").pop() || "..."}`
            : name === "install_package"
              ? `installing ${String(args.package_name ?? args.packageName ?? "")}`
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
          `1. Ensure \`${targetPath}\` exists and has a \`export default\` component.\n` +
          `2. Call \`${PAGE_IMPLEMENTATION_COMPLETE}\` with a brief summary.\n` +
          `Do NOT start new files or features — finalize what you have and call the completion tool.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: lfPageImplementPhaseSlug(page.slug),
  });

  if (!implementationComplete) {
    const implicitTsx = readSiteFile(targetPath);
    const hasDefaultExport =
      implicitTsx.length > 0 &&
      (/export\s+default\s+function\b/.test(implicitTsx) ||
        /export\s+default\s+\w+/.test(implicitTsx));

    if (hasDefaultExport) {
      console.warn(
        `[page_implement_agent:${page.slug}] Agent did not call ${PAGE_IMPLEMENTATION_COMPLETE} ` +
          `but ${targetPath} exists with a valid default export — accepting implicit completion. ` +
          `(model=${model}, toolCalls=${toolCalls.length})`
      );
      implementationComplete = true;
      completeSummary =
        content || `[implicit] Page implemented at ${targetPath}`;
    } else {
      throw new Error(
        `page_implement_agent:${page.slug}: agent exhausted ${maxIterations} iterations ` +
          `without producing ${targetPath} with a default export or calling ` +
          `${PAGE_IMPLEMENTATION_COMPLETE}. Model: ${model}, tool calls: ${toolCalls.length}. ` +
          `Last message: ${(content || "(empty)").slice(0, 300)}`
      );
    }
  }

  const tsx = readSiteFile(targetPath);
  if (!tsx) {
    throw new Error(
      `page_implement_agent:${page.slug}: ${targetPath} is empty or missing ` +
        `after agent signaled completion`
    );
  }
  assertDefaultExportPage(tsx, targetPath);
  if (tsx.includes("Preparing your site")) {
    throw new Error(
      `page_implement_agent:${page.slug}: ${targetPath} is still the default stub ` +
        `("Preparing your site…") after the agent signaled completion`
    );
  }
  await formatSiteFile(targetPath);

  const writtenPaths = Array.from(
    new Set([...sessionState.writtenPaths, ...sessionState.editedPaths, targetPath])
  );

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
