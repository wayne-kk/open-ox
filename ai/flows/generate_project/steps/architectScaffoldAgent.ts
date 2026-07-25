/**
 * Chrome Scaffold Agent — fast, provisional global chrome before page agents.
 */
import {
  composePromptBlocks,
  loadGuardrail,
  loadStepPrompt,
  loadSystem,
  readSiteFile,
} from "../shared/files";
import { LfToolPhase } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessage } from "@/ai/shared/llm/types";
import { getModelForStep, getThinkingLevelForStep } from "@/lib/config/models";
import { SiteFileSessionWorkspace } from "@/ai/shared/fileSession/siteFileSessionWorkspace";
import type { BuildStep, PlannedProjectBlueprint, StepTrace } from "../types";
import { resolveArchitectScaffoldAgentRuleIds } from "../shared/agentRuleBundles";
import { buildUserVisionContent } from "../shared/userVisionContent";
import {
  buildBlueprintPagesSummary,
  buildChromeAgentTrace,
  buildChromeFilePathsFromDisk,
  buildChromePreReadBlock,
  buildChromePreReadContext,
  buildChromeProjectHeader,
  buildMinimalChromeRootLayout,
  chromeLayoutRendersChildren,
  emitChromeBuildProgress,
  hasChromeLayoutDefaultExport,
  truncateChromeAgentText,
} from "../shared/chromeAgentCommon";
import { resolveChromeForm } from "../shared/chromeForm";
import { runChromeBuildSession } from "../chromeBuildSession/chromeBuildSession";

export const ARCHITECT_SCAFFOLD_AGENT_STEP = "architect_scaffold_agent";
/** @deprecated Completion is now decided by ChromeBuildSession verification. */
export const ARCHITECT_SCAFFOLD_COMPLETE = "architect_scaffold_complete";

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
  const plannedChromeForm = resolveChromeForm({
    chromeForm: blueprint.site.informationArchitecture.chromeForm,
  });

  const userMessage = `## Scaffold global chrome (chrome-first — fast draft, links may be provisional)

${buildChromeProjectHeader(blueprint)}

## Planned chromeForm (from Plan — agent-chosen contract)
- **chromeForm**: \`${plannedChromeForm}\`
- If set to a global form, implement that shell. If \`unspecified\`, decide one coherent shell from the brief. Do **not** invent a second shell family on top.
- Never use \`page-local\` / pass-through — Chrome Scaffold always owns the shell (\`none\` = minimal shell still owned here).

## Page plans (Page Agents will implement content next — leave {children} for them)
${pagesSummary}

${buildChromePreReadBlock(preRead)}

## Design system (reference)
${truncateChromeAgentText(designSystem, 10_000)}

## Workflow
1. First call \`create_chrome_layout\`. Honor planned **chromeForm** when set; if it is \`unspecified\`, include the chosen form in that command.
2. For a global form, create the shell under \`components/chrome/**\`; for \`none\`, the minimal layout alone is sufficient. Use revision-safe read/replace commands for later changes.
3. Call \`verify_chrome_files\` once required artifacts exist. A clean verification completes the worker automatically — there is no completion command.

Hard rules:
- Do **not** write \`app/**/page.tsx\` content beyond what layout needs.
- Do **not** perfect single-page \`#\` anchors — Chrome polish will fix after pages exist.
- Do **not** call generic filesystem tools; Chrome commands format and validate writes.
- Do **not** invent a second shell family on top of the chosen form.`;

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

  const maxIterations = Math.max(
    6,
    Math.min(24, Number(process.env.ARCHITECT_SCAFFOLD_AGENT_MAX_ITERATIONS ?? 12))
  );

  const build = await runChromeBuildSession({
    profile: "scaffold",
    chromeForm: plannedChromeForm,
    initialMessages: messages,
    model,
    ...(thinking ? { thinkingLevel: thinking } : {}),
    maxIterations,
    workspace: new SiteFileSessionWorkspace(),
    existingChromePaths: buildChromeFilePathsFromDisk(),
    fallbackLayoutContent: buildMinimalChromeRootLayout(blueprint),
    onEvent: (event) => {
      if (event.kind === "message") {
        onMessage?.(event.message);
        return;
      }
      emitChromeBuildProgress({
        event,
        stepId: ARCHITECT_SCAFFOLD_AGENT_STEP,
        maxIterations,
        onStep,
      });
    },
    langfusePhase: LfToolPhase.architectScaffold,
  });
  const { content, toolCalls } = build;
  const { chromeForm, fellBackToMinimal } = build;
  const layoutContent = readSiteFile("app/layout.tsx");
  if (
    build.finalDecision.kind !== "complete" ||
    !layoutContent ||
    !hasChromeLayoutDefaultExport(layoutContent) ||
    !chromeLayoutRendersChildren(layoutContent)
  ) {
    throw new Error(
      `architect_scaffold_agent failed deterministic layout recovery: ` +
        `${build.finalDecision.kind === "continue" ? build.finalDecision.reason : build.finalDecision.kind === "failed" ? build.finalDecision.error : "invalid layout"}`,
    );
  }
  const completeSummary = fellBackToMinimal
    ? "Scaffold session did not reach a clean verified layout; ChromeBuildSession wrote and verified the minimal fallback."
    : content || "Chrome scaffold artifacts verified.";

  const writtenFiles = new Set(build.writtenPaths);
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
