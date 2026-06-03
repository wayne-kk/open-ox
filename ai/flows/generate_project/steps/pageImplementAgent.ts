/**
 * Per-route UI via multi-turn system tools (Cursor-style), without a fixed section manifest.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  composePromptBlocks,
  formatSiteFile,
  listSiteTree,
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
import { hasUserProvidedContent } from "../schema/normalizeUserProvidedContent";
import {
  prepareUserProvidedContentForPageAgent,
  userProvidedContentFileHint,
  userProvidedContentImagesBlock,
  userProvidedImageCount,
} from "../shared/userProvidedContentContext";
import {
  buildGenerateImageToolForPageAgent,
  guardGenerateImageExecutor,
  listUserProvidedImageUrls,
} from "../shared/userProvidedImageEnforcement";
import { USER_PROVIDED_CONTENT_PATH } from "@/lib/content/userProvidedContentText";

export const PAGE_IMPLEMENTATION_COMPLETE = "page_implementation_complete";

const TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "search_code",
  "format_code",
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
  projectContext: PageAgentProjectContext;
  /**
   * Pre-selected hero/opening-section skill prompt body (already loaded from
   * `prompts/skills/section/<sectionType>/<skillId>.md`). When provided, the
   * agent treats it as the canonical recipe for the hero section.
   */
  heroSkillPrompt?: string;
  /** Skill id for tracing/UI display alongside the agent step record. */
  heroSkillId?: string | null;
  onMessage?: (msg: ChatMessage) => void;
  /** Emit build sub-steps for UI progress visibility (topology + conversation). */
  onStep?: (step: BuildStep) => void;
}

export interface PageImplementAgentResult {
  pagePath: string;
  /** Echoed back from input for logger / UI / artifact persistence. */
  heroSkillId: string | null;
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
    designSystem,
    projectContext,
    heroSkillPrompt,
    heroSkillId,
    onMessage,
    onStep,
  } = params;
  const targetPath = slugToPagePath(page.slug);
  const model = getModelForStep("page_implement_agent");
  const thinking = getThinkingLevelForStep("page_implement_agent");
  const agentStepName = `page_implement_agent:${page.slug}`;
  const userContent = prepareUserProvidedContentForPageAgent(projectContext.userProvidedContent);
  const userImageUrls = listUserProvidedImageUrls(
    userContent,
    projectContext.rawUserInput ?? ""
  );
  const userImageCount = userImageUrls.length;
  const userProvidedMd = (() => {
    try {
      const text = readSiteFile(USER_PROVIDED_CONTENT_PATH);
      return text && !text.includes("(missing") ? text : "";
    } catch {
      return "";
    }
  })();

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

  // Pre-warm context: read the chrome contract + globals + components tree
  // up front so the agent does NOT need to spend round-trips on read_file /
  // list_dir for the obvious things.
  const layoutTsx = readSiteFile("app/layout.tsx") || "(missing — fallback to minimal layout)";
  const globalsCss = readSiteFile("app/globals.css");
  const componentsTree = listSiteTree("components", { maxDepth: 3, maxEntries: 160 });
  const appTree = listSiteTree("app", { maxDepth: 2, maxEntries: 80 });

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

## Pre-read context (already loaded for you — do NOT re-read these files)

### \`app/layout.tsx\` — chrome contract (read-only, authored by Architect Agent)
\`\`\`tsx
${layoutTsx}
\`\`\`

### \`app/globals.css\` (truncated)
\`\`\`css
${truncate(globalsCss || "(empty)", 6_000)}
\`\`\`

### Existing \`app/\` tree (for context — only \`page.tsx\` files matter)
\`\`\`
${appTree}
\`\`\`

### Existing \`components/\` tree
\`\`\`
${componentsTree}
\`\`\`

## Layout contract (read-only)
\`app/layout.tsx\` above is the **single source of truth** for global chrome. \`components/chrome/**\` (or wherever the architect placed shared chrome components) is owned by the Architect Agent and is **read-only** for you.

- If layout.tsx already mounts global chrome (top nav, sidebar, topbar, footer, HUD, etc.), do **not** duplicate, replace, or remove that chrome inside this page route.
- If it is intentionally minimal (only \`<html>\`/\`<body>\` with \`{children}\`), the architect decided this product is fullscreen / single-canvas / minimal — the page owns any chrome it needs.
- **Do not edit** \`app/layout.tsx\` or any file under \`components/chrome/**\`. If something is genuinely missing for your page (rare), add a page-local solution inside this route's own subtree instead.

## Project
- Title: ${projectContext.projectTitle}
- Description: ${projectContext.projectDescription}
- Language (bcp47): ${projectContext.language}
- Design keywords: ${projectContext.designKeywords.join(", ")}

## Design system (reference — already loaded; \`design-system.md\` need not be re-read)
${designSystem}
${
  heroSkillPrompt
    ? `

## Hero / opening-section skill (canonical recipe — must follow when implementing the hero)
> Skill id: \`${heroSkillId ?? "(unknown)"}\` — the design system above sets the global token palette; the recipe below sets the hero section's structure, motion, and component layout. Treat the recipe as the source of truth for the hero; never invent a different hero pattern when this skill is provided.

${heroSkillPrompt}`
    : ""
}
${userProvidedContentFileHint(hasUserProvidedContent(userContent))}
${userProvidedContentImagesBlock(userContent)}
${
  userProvidedMd
    ? `

## content/user-provided.md (on disk — use image URLs below)
\`\`\`markdown
${truncate(userProvidedMd, 12_000)}
\`\`\``
    : ""
}

## Instructions (follow in order)
1. **Decide structure**: review the pre-read context above; you can skip read_file for layout.tsx / globals.css / design-system / app tree / components tree. If you genuinely need a specific component file's contents, then \`read_file\` it.
2. **User content & images**: If \`content/user-provided.md\` exists, \`read_file\` it. Use listed **https image URLs as remote src** (lh3.googleusercontent.com is allowed in next.config). Do **not** download user photos. **Each user URL at most once** — never reuse the same URL in two components. Do **not** use \`generate_image\` to stand in for a user photo.${
    userImageCount > 0
      ? ` You have ${userImageCount} user URL(s): assign them first; only after all are used, call \`generate_image\` for any remaining image slots.`
      : " Use `generate_image` only when you need visuals with no user-provided URLs."
  }
3. **Implement**: \`write_file\` / \`edit_file\` to create \`${targetPath}\` and extract page-local components under \`components/\` (your own subtree, e.g. \`components/<page-feature>/**\`). Respect design tokens. **Do not modify** \`app/layout.tsx\` or any file under \`components/chrome/**\`. Files are auto-formatted with Prettier on write — you do **not** need to call \`format_code\` afterwards.
4. **Complete**: call **\`${PAGE_IMPLEMENTATION_COMPLETE}\`** with a summary of files and layout approach.

⚠️ Step 4 is mandatory. The pipeline fails if you do not call \`${PAGE_IMPLEMENTATION_COMPLETE}\`.

Do not invent extra top-level routes beyond this page.`;

  const refShot = projectContext.referenceScreenshotDataUrl ?? null;
  const refGuardId = screenshotGuardrailIdFromContext(
    projectContext.screenshotIntentMode,
    Boolean(refShot?.trim())
  );
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("pageImplementAgent"),
    ...(refGuardId ? [loadGuardrail(refGuardId)] : []),
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

  const { executor: baseImageExecutor, pendingImages } = createImageExecutor(
    `page-${page.slug.replace(/[^a-zA-Z0-9_-]+/g, "-")}`
  );
  const imageExecutor = guardGenerateImageExecutor(baseImageExecutor, userImageUrls);
  const pageTools: ChatCompletionTool[] = [
    ...getSystemToolDefinitions(
      TOOL_NAMES.filter((name) => name !== "generate_image")
    ),
    ...(userImageCount > 0
      ? [buildGenerateImageToolForPageAgent(userImageCount)]
      : getSystemToolDefinitions(["generate_image"])),
    completeTool,
  ];

  let implementationComplete = false;
  let completeSummary = "";

  const maxIterations = Math.max(
    12,
    Math.min(96, Number(process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS ?? 48))
  );

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: pageTools,
    temperature: 0.5,
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
          `2. Call \`${PAGE_IMPLEMENTATION_COMPLETE}\` with a brief summary.\n` +
          `Files are auto-formatted on write — no need to call format_code. ` +
          `Do NOT start new files or features — finalize what you have and call the completion tool.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: lfPageImplementPhaseSlug(page.slug),
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
      pageDesignPlan: page.pageDesignPlan,
      heroSkillId: heroSkillId ?? null,
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
    heroSkillId: heroSkillId ?? null,
    trace,
    pendingImages,
    summary: completeSummary || content.slice(0, 500) || "ok",
    toolCallRecords: toolCalls.length,
  };
}
