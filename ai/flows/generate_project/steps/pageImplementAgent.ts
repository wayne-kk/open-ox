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
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { createImageExecutor } from "@/ai/tools/system/generateImageTool";
import type { PendingImage } from "@/ai/tools/system/generateImageTool";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { slugToPagePath } from "../shared/paths";
import type { BuildStep, PlannedPageBlueprint, StepTrace } from "../types";
import type { GenerateSectionProjectContext } from "./generateSection/types";

export const PAGE_IMPLEMENTATION_COMPLETE = "page_implementation_complete";

const TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "search_code",
  "format_code",
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
      "extracted components live under components/, imports resolve, and format_code " +
      "has been applied to every .tsx you touched. After you call this, the global " +
      "pipeline runs a production build — do NOT skip this tool.",
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
  projectContext: GenerateSectionProjectContext;
  /** True when blueprint has layout shell sections composed into `app/layout.tsx`. */
  hasLayoutChrome: boolean;
  onMessage?: (msg: ChatMessage) => void;
  /** Emit build sub-steps for UI progress visibility (topology + conversation). */
  onStep?: (step: BuildStep) => void;
}

export interface PageImplementAgentResult {
  pagePath: string;
  trace: StepTrace;
  pendingImages: PendingImage[];
  summary: string;
  toolCallRecords: number;
}

export async function runPageImplementAgent(
  params: RunPageImplementAgentParams
): Promise<PageImplementAgentResult> {
  const { page, designSystem, projectContext, hasLayoutChrome, onMessage, onStep } = params;
  const targetPath = slugToPagePath(page.slug);
  const model = getModelForStep("page_implement_agent");
  const thinking = getThinkingLevelForStep("page_implement_agent");
  const agentStepName = `page_implement_agent:${page.slug}`;

  const shellHint = hasLayoutChrome
    ? "Global Navigation/Footer (or other layout sections) exist in app/layout.tsx — do not duplicate the global chrome inside this page route."
    : "Root layout is minimal — implement the complete product UI in this route and colocated components (including chrome such as headers/sidebars if the product requires them).";

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

  const userMessage = `## Implement this Next.js route (App Router)

**Target page file**: \`${targetPath}\`
**Slug**: ${page.slug}
**Page title**: ${page.title}

## Page description
${page.description}

## Journey stage
${page.journeyStage}

## Page design plan (canonical)
${planJson}

## Shell / layout mode
${shellHint}

## Project
- Title: ${projectContext.projectTitle}
- Description: ${projectContext.projectDescription}
- Language (bcp47): ${projectContext.language}
- Design keywords: ${projectContext.designKeywords.join(", ")}

## Design system (reference)
${truncate(designSystem, 14_000)}

## Instructions (follow in order)
1. **Explore first**: \`list_dir\` + \`read_file\` to inspect \`app/layout.tsx\`, \`app/globals.css\`, \`design-system.md\`, and existing \`components/\`.
2. **Implement**: \`write_file\` / \`edit_file\` to create \`${targetPath}\` and extract meaningful components under \`components/\`. Respect design tokens.
3. **Format**: run \`format_code\` on every .tsx file you wrote or edited.
4. **Complete**: call **\`${PAGE_IMPLEMENTATION_COMPLETE}\`** with a summary of files and layout approach.

⚠️ Step 4 is mandatory. The pipeline fails if you do not call \`${PAGE_IMPLEMENTATION_COMPLETE}\`.

Do not invent extra top-level routes beyond this page.`;

  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("pageImplementAgent"),
    loadGuardrail("framerMotionVariants"),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const { executor: imageExecutor, pendingImages } = createImageExecutor(
    `page-${page.slug.replace(/[^a-zA-Z0-9_-]+/g, "-")}`
  );

  let implementationComplete = false;
  let completeSummary = "";

  const maxIterations = Math.max(
    12,
    Math.min(96, Number(process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS ?? 48))
  );

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [...getSystemToolDefinitions([...TOOL_NAMES]), completeTool],
    temperature: 0.2,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      [PAGE_IMPLEMENTATION_COMPLETE]: async (
        args: Record<string, unknown>
      ): Promise<ToolResult> => {
        implementationComplete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        return { success: true, output: "page_implementation_complete acknowledged" };
      },
      generate_image: imageExecutor,
    },
    onMessage,
    shouldAbortAfterToolResults: () => implementationComplete,
    requireTools: true,
    onToolCall: ({ name, args, iteration }) => {
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
            : name === "format_code"
              ? `formatting ${String(args.path ?? "").split("/").pop() || "..."}`
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
          `2. Run \`format_code\` on every .tsx file you wrote or edited.\n` +
          `3. Call \`${PAGE_IMPLEMENTATION_COMPLETE}\` with a brief summary.\n` +
          `Do NOT start new files or features — finalize what you have and call the completion tool.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
  });

  // ── Completion validation ────────────────────────────────────────────────
  // If the agent didn't explicitly call the completion tool, check whether it
  // nevertheless produced a valid page file. This avoids a hard failure when
  // the model does the right work but forgets the bookkeeping tool call.
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

  // Validate the output regardless of explicit vs. implicit completion
  const tsx = readSiteFile(targetPath);
  if (!tsx) {
    throw new Error(
      `page_implement_agent:${page.slug}: ${targetPath} is empty or missing ` +
        `after agent signaled completion`
    );
  }
  assertDefaultExportPage(tsx, targetPath);
  await formatSiteFile(targetPath);

  const trace: StepTrace = {
    input: {
      slug: page.slug,
      targetPath,
      hasLayoutChrome,
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
    trace,
    pendingImages,
    summary: completeSummary || content.slice(0, 500) || "ok",
    toolCallRecords: toolCalls.length,
  };
}
