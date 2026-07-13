import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLMWithMetaUserContent, extractJSON } from "../shared/llm";
import { buildUserVisionContent, visionTraceUserLabel } from "../shared/userVisionContent";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type { ProjectIntentGuideResult, StepTrace } from "../types";
import { getModelForStep } from "@/lib/config/models";

const VALID_PHASES = new Set([
  "meta_capability",
  "clarify",
  "confirm_summary",
  "choices",
  "build_ready",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxLen);
}

/** Exported for unit tests — parses raw LLM JSON record into a normalized shape (no trace). */
export function parseProjectIntentGuidePayload(parsed: unknown): Omit<ProjectIntentGuideResult, "trace"> {
  const root = isRecord(parsed) ? parsed : {};

  const outcomeRaw = root.outcome;
  const outcome: ProjectIntentGuideResult["outcome"] =
    outcomeRaw === "continue_build" ? "continue_build" : "guide_user";

  const phaseRaw = root.phase;
  const phaseFromModel: ProjectIntentGuideResult["phase"] =
    typeof phaseRaw === "string" && VALID_PHASES.has(phaseRaw)
      ? (phaseRaw as ProjectIntentGuideResult["phase"])
      : "clarify";

  const phase: ProjectIntentGuideResult["phase"] =
    outcome === "continue_build" ? "build_ready" : phaseFromModel;

  const assistantMessage =
    typeof root.assistantMessage === "string" && root.assistantMessage.trim()
      ? root.assistantMessage.trim()
      : "请用一句话描述你想做的网站或页面（目标用户、核心内容、是否需要强交互）。";

  const suggestedReplies = asStringArray(root.suggestedReplies, 3);

  let buildPromptAppendix: string | null = null;
  if (outcome === "continue_build" && typeof root.buildPromptAppendix === "string") {
    const t = root.buildPromptAppendix.trim();
    buildPromptAppendix = t.length > 0 ? t : null;
  }

  return {
    outcome,
    phase,
    assistantMessage,
    suggestedReplies,
    buildPromptAppendix,
  };
}

export function buildEffectiveUserPromptForGeneration(userInput: string, appendix: string | null): string {
  const base = userInput.trim();
  const extra = appendix?.trim();
  if (!extra) return base;
  return `## Original user message\n${base}\n\n## Clarified / polished intent (from guided dialogue)\n${extra}`;
}

export async function stepProjectIntentGuide(
  userInput: string,
  options?: { imageBase64?: string | null }
): Promise<ProjectIntentGuideResult> {
  const model = getModelForStep("project_intent_guide");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("projectIntentGuide"),
    loadGuardrail("outputJson"),
  ]);

  const userContent = buildUserVisionContent(userInput, options?.imageBase64 ?? null);
  const traceLabel = visionTraceUserLabel(userInput, Boolean(options?.imageBase64?.trim()));

  const meta = await callLLMWithMetaUserContent(systemPrompt, userContent, 0.45, undefined, model, {
    langfuseName: lfPlain(LfPlain.projectIntentGuide),
  });
  const raw = meta.content;
  const trace: StepTrace = stepTraceFromLlmCompletion(systemPrompt, traceLabel, meta);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    throw new Error(
      `project_intent_guide: failed to parse JSON.\nRaw output:\n${raw.slice(0, 4000)}`
    );
  }

  const body = parseProjectIntentGuidePayload(parsed);
  return { ...body, trace };
}
