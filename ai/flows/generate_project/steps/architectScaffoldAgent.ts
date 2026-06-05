/**
 * Chrome Scaffold Agent — fast, provisional global chrome before page agents.
 */
import {
  composePromptBlocks,
  formatSiteFile,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
  writeSiteFile,
} from "../shared/files";
import { callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import type { BuildStep, PlannedProjectBlueprint, StepTrace } from "../types";
import { resolveArchitectScaffoldAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
import {
  buildBlueprintPagesSummary,
  buildChromeAgentTrace,
  buildChromeCompleteTool,
  buildChromePreReadBlock,
  buildChromePreReadContext,
  buildChromeProjectHeader,
  buildMinimalChromeRootLayout,
  CHROME_AGENT_TOOL_NAMES,
  CHROME_AGENT_VISIBLE_TOOL_NAMES,
  chromeLayoutRendersChildren,
  collectChromeFilesFromToolCalls,
  hasChromeLayoutDefaultExport,
  truncateChromeAgentText,
} from "../shared/chromeAgentCommon";

export const ARCHITECT_SCAFFOLD_AGENT_STEP = "architect_scaffold_agent";
export const ARCHITECT_SCAFFOLD_COMPLETE = "architect_scaffold_complete";

const completeTool = buildChromeCompleteTool(
  ARCHITECT_SCAFFOLD_COMPLETE,
  "MANDATORY — call exactly once after scaffold layout and chrome components are on disk. " +
    "Preconditions: `app/layout.tsx` exists with default export rendering `{children}`, " +
    "chrome components imported by layout exist. Page agents start next — links may be provisional."
);

export interface RunArchitectScaffoldAgentParams {
  blueprint: PlannedProjectBlueprint;
  designSystem: string;
  referenceScreenshotDataUrl?: string | null;
  screenshotGuardrailId?: string | null;
  onMessage?: (msg: ChatMessage) => void;
  onStep?: (step: BuildStep) => void;
}

export interface ArchitectScaffoldAgentResult {
  layoutPath: string;
  files: string[];
  summary: string;
  chromeForm: string;
  fellBackToMinimal: boolean;
  trace: StepTrace;
  toolCallRecords: number;
}

export async function runArchitectScaffoldAgent(
  params: RunArchitectScaffoldAgentParams
): Promise<ArchitectScaffoldAgentResult> {
  const {
    blueprint,
    designSystem,
    referenceScreenshotDataUrl,
    screenshotGuardrailId,
    onMessage,
    onStep,
  } = params;
  const model = getModelForStep(ARCHITECT_SCAFFOLD_AGENT_STEP);
  const thinking = getThinkingLevelForStep(ARCHITECT_SCAFFOLD_AGENT_STEP);
  const preRead = buildChromePreReadContext();
  const pagesSummary = buildBlueprintPagesSummary(blueprint);

  const userMessage = `## Scaffold global chrome (fast draft — links may be provisional)

${buildChromeProjectHeader(blueprint)}

## Page plans (Page Agents will implement these next)
${pagesSummary}

${buildChromePreReadBlock(preRead)}

## Design system (reference)
${truncateChromeAgentText(designSystem, 10_000)}

## Workflow
1. Pick chrome **form** from product type (see system prompt table).
2. Write \`app/layout.tsx\` + \`components/chrome/**\` with **complete structure** but **provisional** nav/footer links.
3. Call \`${ARCHITECT_SCAFFOLD_COMPLETE}\` within a few tool rounds — do not polish.

Hard rules:
- Do **not** write \`app/**/page.tsx\`.
- Do **not** perfect anchor links for single-page sites — Chrome Optimize Agent will fix after pages exist.
- Do **not** call \`format_code\` on files you wrote.`;

  const refGr =
    referenceScreenshotDataUrl?.trim() && screenshotGuardrailId?.trim()
      ? screenshotGuardrailId.trim()
      : referenceScreenshotDataUrl?.trim()
        ? "screenshotLayoutFidelity"
        : null;
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("architectScaffoldAgent"),
    ...(refGr ? [loadGuardrail(refGr)] : []),
    ...resolveArchitectScaffoldAgentRuleIds().map(loadGuardrail),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserVisionContent(userMessage, referenceScreenshotDataUrl ?? null),
    },
  ];

  let scaffoldComplete = false;
  let completeSummary = "";
  let chromeForm = "unspecified";

  const maxIterations = Math.max(
    6,
    Math.min(24, Number(process.env.ARCHITECT_SCAFFOLD_AGENT_MAX_ITERATIONS ?? 12))
  );

  const { content, toolCalls } = await callLLMWithToolsFromMessages({
    messages,
    tools: [...getSystemToolDefinitions([...CHROME_AGENT_TOOL_NAMES]), completeTool],
    temperature: 0.4,
    maxIterations,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    executeToolOverrides: {
      [ARCHITECT_SCAFFOLD_COMPLETE]: async (
        args: Record<string, unknown>
      ): Promise<ToolResult> => {
        scaffoldComplete = true;
        completeSummary = typeof args.summary === "string" ? args.summary.trim() : "";
        chromeForm =
          typeof args.chromeForm === "string" && args.chromeForm.trim()
            ? args.chromeForm.trim()
            : chromeForm;
        return { success: true, output: "architect_scaffold_complete acknowledged" };
      },
    },
    onMessage,
    shouldAbortAfterToolResults: () => scaffoldComplete,
    onToolCall: ({ name, args, iteration }) => {
      if (!onStep) return;
      if (CHROME_AGENT_VISIBLE_TOOL_NAMES.has(name)) {
        const filePath = String(args.path ?? "");
        onStep({
          step: `architect_scaffold_agent_tool:${name}:${iteration}`,
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
          step: ARCHITECT_SCAFFOLD_AGENT_STEP,
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
          `[Iteration Budget] Wrap up scaffold now:\n` +
          `1. Ensure \`app/layout.tsx\` exists with \`{children}\`.\n` +
          `2. Ensure chrome components imported by layout exist.\n` +
          `3. Call \`${ARCHITECT_SCAFFOLD_COMPLETE}\` — links can stay provisional.`,
      };
      msgs.push(nudge);
      onMessage?.(nudge);
    },
    langfusePhase: LfToolPhase.architectScaffold,
  });

  let fellBackToMinimal = false;
  let layoutContent = readSiteFile("app/layout.tsx");

  if (
    !layoutContent ||
    !hasChromeLayoutDefaultExport(layoutContent) ||
    !chromeLayoutRendersChildren(layoutContent)
  ) {
    console.warn(
      `[architect_scaffold_agent] layout invalid after agent run ` +
        `(complete=${scaffoldComplete}, toolCalls=${toolCalls.length}, model=${model}). ` +
        `Falling back to minimal root layout.`
    );
    await writeSiteFile("app/layout.tsx", buildMinimalChromeRootLayout(blueprint));
    await formatSiteFile("app/layout.tsx");
    fellBackToMinimal = true;
    chromeForm = "minimal-fallback";
    if (!completeSummary) {
      completeSummary =
        "Scaffold agent did not produce a valid layout; pipeline fell back to minimal root layout.";
    }
    layoutContent = readSiteFile("app/layout.tsx");
  } else {
    await formatSiteFile("app/layout.tsx");
  }

  const writtenFiles = collectChromeFilesFromToolCalls(toolCalls);
  const trace = buildChromeAgentTrace({
    blueprint,
    chromeForm,
    fellBackToMinimal,
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
    fellBackToMinimal,
    trace,
    toolCallRecords: toolCalls.length,
  };
}
