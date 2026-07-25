/**
 * Chrome Agent — one-shot global chrome after all pages are implemented.
 * (Step id remains `chrome_optimize_agent` for checkpoint / studio compat.)
 */
import {
  composePromptBlocks,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
} from "../shared/files";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { SiteFileSessionWorkspace } from "@/ai/shared/fileSession/siteFileSessionWorkspace";
import type { BuildStep, PlannedProjectBlueprint, StepTrace } from "../types";
import { resolveChromeOptimizeAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
import {
  buildBlueprintPagesSummary,
  buildChromeAgentTrace,
  buildChromeLinkSurveyBlock,
  buildChromeLinkSurveyFromDisk,
  buildChromePreReadBlock,
  buildChromePreReadContext,
  buildChromeProjectHeader,
  emitChromeBuildProgress,
  truncateChromeAgentText,
} from "../shared/chromeAgentCommon";
import { resolveChromeForm } from "../shared/chromeForm";
import { runChromeBuildSession } from "../chromeBuildSession/chromeBuildSession";

export const CHROME_OPTIMIZE_AGENT_STEP = "chrome_optimize_agent";

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

  const userMessage = `## Polish existing global chrome (pages are already implemented)

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
1. **Polish only** — global chrome was already scaffolded. Use \`read_chrome_file\` for an exact revision and \`replace_chrome_file\` for a full-file CAS replacement.
2. You may modify only the existing Chrome paths adopted by the runtime; no create or generic write command exists.
3. After a replacement, call \`verify_chrome_files\` immediately. If no change is needed, a clean verification completes the worker.

Hard rules:
- Do **not** re-survey page section components.
- Do **not** modify \`app/**/page.tsx\`.
- Do **not** modify \`app/globals.css\`.
- Do **not** invent routes or \`#id\` anchors missing from the Disk survey.
- Do **not** mount a second global Nav on top of an existing shell.
- Do **not** move shell into pages (\`page-local\` removed).`;

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

  const chromeForm = resolveChromeForm({ chromeForm: scaffoldContext.chromeForm });

  const maxIterations = Math.max(
    6,
    Math.min(14, Number(process.env.CHROME_OPTIMIZE_AGENT_MAX_ITERATIONS ?? 10))
  );

  const build = await runChromeBuildSession({
    profile: "optimize",
    chromeForm,
    initialMessages: messages,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    maxIterations,
    workspace: new SiteFileSessionWorkspace(),
    existingChromePaths: linkSurvey.chromeFiles.map((file) => file.path),
    onEvent: (event) => {
      if (event.kind === "message") {
        onMessage?.(event.message);
        return;
      }
      emitChromeBuildProgress({
        event,
        stepId: CHROME_OPTIMIZE_AGENT_STEP,
        maxIterations,
        onStep,
      });
    },
    langfusePhase: LfToolPhase.chromeOptimize,
  });
  const { content, toolCalls } = build;
  if (build.finalDecision.kind !== "complete") {
    throw new Error(
      `chrome_optimize_agent stopped after ${build.iterationsUsed}/${maxIterations} iterations: ` +
        `${build.finalDecision.kind === "continue" ? build.finalDecision.reason : build.finalDecision.error}. ` +
        `Empty-stop recoveries: ${build.emptyStopRecoveries}/2. Model: ${model}, tool calls: ${toolCalls.length}.`,
    );
  }
  const completeSummary = content || "Existing Chrome artifacts verified.";
  const writtenFiles = new Set(build.writtenPaths);
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
