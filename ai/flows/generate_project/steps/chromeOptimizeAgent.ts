/**
 * Chrome Agent — one-shot global chrome after all pages are implemented.
 * (Step id remains `chrome_optimize_agent` for checkpoint / studio compat.)
 */
import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import type { BuildStep, PlannedProjectBlueprint, StepTrace } from "../types";
import { resolveChromeOptimizeAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
import {
  buildBlueprintPagesSummary,
  buildChromeAgentTrace,
  buildChromeCompleteTool,
  buildChromeLinkSurveyBlock,
  buildChromeLinkSurveyFromDisk,
  buildChromePreReadBlock,
  buildChromePreReadContext,
  buildChromeProjectHeader,
  CHROME_AGENT_TOOL_NAMES,
  CHROME_AGENT_VISIBLE_TOOL_NAMES,
  collectChromeFilesFromToolCalls,
  truncateChromeAgentText,
} from "../shared/chromeAgentCommon";

export const CHROME_OPTIMIZE_AGENT_STEP = "chrome_optimize_agent";
export const CHROME_OPTIMIZE_COMPLETE = "chrome_optimize_complete";

const completeTool = buildChromeCompleteTool(
  CHROME_OPTIMIZE_COMPLETE,
  "MANDATORY — call exactly once after global chrome is written. " +
    "Preconditions: components/chrome/** exist, app/layout.tsx mounts them and renders {children}, " +
    "Nav/Footer hrefs match the Disk survey routes and section ids.",
  {
    linksCorrected: {
      type: "array",
      items: { type: "string" },
      description: "List of hrefs you set (e.g. '/', '/pricing', '#features').",
    },
  }
);

export interface PageImplementSummary {
  slug: string;
  title: string;
  summary: string;
  pagePath: string;
}

export interface ScaffoldContext {
  summary: string;
  chromeForm: string;
}

export interface RunChromeOptimizeAgentParams {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  /** Prior pass-through / deferred layout note — not provisional chrome. */
  scaffoldContext: ScaffoldContext;
  pageSummaries: PageImplementSummary[];
  referenceScreenshotDataUrl?: string | null;
  screenshotGuardrailId?: string | null;
  onMessage?: (msg: ChatMessage) => void;
  onStep?: (step: BuildStep) => void;
}

export interface ChromeOptimizeAgentResult {
  layoutPath: string;
  files: string[];
  summary: string;
  chromeForm: string;
  trace: StepTrace;
  toolCallRecords: number;
}

function buildPageSummariesBlock(summaries: PageImplementSummary[]): string {
  if (summaries.length === 0) return "(no page summaries)";
  return summaries
    .map(
      (p) =>
        `- **${p.title}** (\`${p.pagePath}\`, slug: \`${p.slug}\`)\n  summary: ${p.summary || "(none)"}`
    )
    .join("\n");
}

export async function runChromeOptimizeAgent(
  params: RunChromeOptimizeAgentParams
): Promise<ChromeOptimizeAgentResult> {
  const {
    blueprint,
    designSystem,
    scaffoldContext,
    pageSummaries,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
    onMessage,
    onStep,
  } = params;
  const model = getModelForStep(CHROME_OPTIMIZE_AGENT_STEP);
  const thinking = getThinkingLevelForStep(CHROME_OPTIMIZE_AGENT_STEP);
  const preRead = buildChromePreReadContext();
  const linkSurvey = buildChromeLinkSurveyFromDisk();

  const userMessage = `## Create global chrome once (pages are already implemented)

${buildChromeProjectHeader(blueprint)}

## Prior layout note
- **chromeForm**: ${scaffoldContext.chromeForm}
- **summary**: ${scaffoldContext.summary}

## Page Agent summaries (context only — Disk survey is source of truth for hrefs)
${buildPageSummariesBlock(pageSummaries)}

## Blueprint page plans (reference)
${buildBlueprintPagesSummary(blueprint)}

${buildChromeLinkSurveyBlock(linkSurvey)}

${buildChromePreReadBlock(preRead)}

## Design system (reference)
${truncateChromeAgentText(designSystem, 6_000)}

## Workflow
1. **Polish only** — global chrome was already scaffolded (chrome-first). Fix Nav/Footer hrefs from the Disk survey; do **not** invent a second Navigation.
2. If Prior \`chromeForm\` is \`page-local\` / \`none\` or layout is pass-through: keep it; call complete immediately.
3. Optional micro-polish (sticky / mobile menu) if budget remains.
4. Call \`${CHROME_OPTIMIZE_COMPLETE}\` promptly (target ≤8 tool rounds).

Hard rules:
- Do **not** re-survey page section components.
- Do **not** modify \`app/**/page.tsx\`.
- Do **not** modify \`app/globals.css\`.
- Do **not** invent routes or \`#id\` anchors missing from the Disk survey.
- Do **not** mount a second global Nav on top of an existing shell.`;

  const refGr =
    referenceScreenshotDataUrl?.trim() && screenshotGuardrailId?.trim()
      ? screenshotGuardrailId.trim()
      : referenceScreenshotDataUrl?.trim()
        ? "screenshotLayoutFidelity"
        : null;
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("chromeOptimizeAgent"),
    ...(refGr ? [loadGuardrail(refGr)] : []),
    ...resolveChromeOptimizeAgentRuleIds().map(loadGuardrail),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserVisionContent(userMessage, referenceScreenshotDataUrl ?? null),
    },
  ];

  let optimizeComplete = false;
  let completeSummary = "";
  let chromeForm = scaffoldContext.chromeForm || "unspecified";

  const maxIterations = Math.max(
    6,
    Math.min(14, Number(process.env.CHROME_OPTIMIZE_AGENT_MAX_ITERATIONS ?? 10))
  );

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [...getSystemToolDefinitions([...CHROME_AGENT_TOOL_NAMES]), completeTool],
    temperature: 0.35,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      [CHROME_OPTIMIZE_COMPLETE]: async (
        args: Record<string, unknown>
      ): Promise<ToolResult> => {
        optimizeComplete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        chromeForm =
          typeof args.chromeForm === "string" && args.chromeForm.trim()
            ? args.chromeForm.trim()
            : chromeForm;
        return { success: true, output: "chrome_optimize_complete acknowledged" };
      },
    },
    onMessage,
    shouldAbortAfterToolResults: () => optimizeComplete,
    onToolCall: ({ name, args, iteration }) => {
      if (!onStep) return;
      if (CHROME_AGENT_VISIBLE_TOOL_NAMES.has(name)) {
        const filePath = String(args.path ?? "");
        onStep({
          step: `chrome_optimize_agent_tool:${name}:${iteration}`,
          status: "ok",
          detail: `${name.replace("_", " ")}: ${filePath}`,
          timestamp: Date.now(),
          duration: 0,
        });
      }
      const detail =
        name === "read_file" || name === "list_dir" || name === "search_code"
          ? `reading ${String(args.path ?? args.query ?? "").split("/").pop() || "..."}`
          : name === "write_file" || name === "edit_file"
            ? `writing ${String(args.path ?? "").split("/").pop() || "..."}`
            : name === "install_package"
              ? `installing ${String(args.package_name ?? args.packageName ?? "")}`
              : undefined;
      if (detail) {
        onStep({
          step: CHROME_OPTIMIZE_AGENT_STEP,
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
          `[Iteration Budget] Finish chrome NOW:\n` +
          `1. Ensure layout mounts chrome and Nav/Footer hrefs match the Disk survey.\n` +
          `2. Call \`${CHROME_OPTIMIZE_COMPLETE}\` — do not read more page components.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: LfToolPhase.chromeOptimize,
  });

  if (readSiteFile("app/layout.tsx")) {
    await formatSiteFile("app/layout.tsx");
  }

  const writtenFiles = collectChromeFilesFromToolCalls(toolCalls);
  const trace = buildChromeAgentTrace({
    blueprint,
    chromeForm,
    fellBackToMinimal: false,
    writtenFiles,
    completeSummary,
    content,
    toolCalls,
    model,
    thinking,
    systemPrompt,
    userMessage,
  });

  return {
    layoutPath: "app/layout.tsx",
    files: Array.from(writtenFiles),
    summary: completeSummary || content.slice(0, 500) || "ok",
    chromeForm,
    trace,
    toolCallRecords: toolCalls.length,
  };
}
