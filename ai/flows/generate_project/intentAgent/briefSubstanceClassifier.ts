import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import { DRAFT_FALLBACK_MIN, SUBSTANTIVE_MIN } from "./commitMergeBrief";

const INPUT_CLIP = 6000;

/** Enough headroom when the step uses a reasoning/thinking-capable model (192 was truncating JSON). */
const CLASSIFIER_OUTPUT_MAX_TOKENS = 4096;

export interface BriefSubstanceClassification {
  mergedBriefFieldSubstantive: boolean;
  tailSubstantive: boolean;
  bootstrapSubstantive: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clipForPrompt(s: string): string {
  const t = s.trim();
  if (t.length <= INPUT_CLIP) return t;
  return `${t.slice(0, INPUT_CLIP)}…`;
}

/** Pure parse after {@link extractJSON} — used in tests and after the LLM returns. */
export function parseBriefSubstanceClassification(parsed: unknown): BriefSubstanceClassification {
  const root = isRecord(parsed) ? parsed : {};
  return {
    mergedBriefFieldSubstantive: root.mergedBriefSubstantive === true,
    tailSubstantive: root.tailSubstantive === true,
    bootstrapSubstantive: root.bootstrapSubstantive === true,
  };
}

/**
 * Length-only fallback when the classifier JSON is truncated or malformed.
 * Mirrors {@link resolveCommitMergedBrief} gates so commits do not fail spuriously.
 */
export function briefSubstanceHeuristicLengths(params: {
  mergedBriefRaw: string;
  tailUserMessage: string;
  bootstrapUserPrompt: string;
}): BriefSubstanceClassification {
  const raw = params.mergedBriefRaw.trim();
  const tail = params.tailUserMessage.trim();
  const boot = params.bootstrapUserPrompt.trim();

  return {
    mergedBriefFieldSubstantive: raw.length >= DRAFT_FALLBACK_MIN,
    tailSubstantive: tail.length >= SUBSTANTIVE_MIN,
    bootstrapSubstantive: boot.length >= SUBSTANTIVE_MIN,
  };
}

/**
 * LLM-only distinction: procedural confirm vs substantive website brief text for merge resolution.
 */
export async function classifyBriefSubstanceForCommit(params: {
  mergedBriefRaw: string;
  tailUserMessage: string;
  bootstrapUserPrompt: string;
}): Promise<BriefSubstanceClassification> {
  const raw = params.mergedBriefRaw.trim();
  const tail = params.tailUserMessage.trim();
  const boot = params.bootstrapUserPrompt.trim();

  if (!raw && !tail && !boot) {
    return {
      mergedBriefFieldSubstantive: false,
      tailSubstantive: false,
      bootstrapSubstantive: false,
    };
  }

  const heuristic = briefSubstanceHeuristicLengths({
    mergedBriefRaw: raw,
    tailUserMessage: tail,
    bootstrapUserPrompt: boot,
  });
  if (
    heuristic.mergedBriefFieldSubstantive &&
    heuristic.bootstrapSubstantive &&
    !heuristic.tailSubstantive
  ) {
    return applySubstanceGate({
      mergedBriefRaw: raw,
      tailUserMessage: tail,
      bootstrapUserPrompt: boot,
      inner: heuristic,
    });
  }

  const model = getModelForStep("commit_merged_brief_classifier");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("commitMergedBriefSubstance"),
    loadGuardrail("outputJson"),
  ]);

  const userPayload = JSON.stringify({
    merged_brief_from_commit_tool: clipForPrompt(raw),
    user_latest_message: clipForPrompt(tail),
    original_bootstrap_prompt: clipForPrompt(boot),
  });

  const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.2, CLASSIFIER_OUTPUT_MAX_TOKENS, model, {
    langfuseName: lfPlain(LfPlain.commitMergedBriefSubstance),
  });

  let parsed: unknown;
  try {
    const slice = extractJSON(meta.content);
    parsed = JSON.parse(slice);
  } catch {
    return applySubstanceGate({
      mergedBriefRaw: raw,
      tailUserMessage: tail,
      bootstrapUserPrompt: boot,
      inner: briefSubstanceHeuristicLengths({
        mergedBriefRaw: raw,
        tailUserMessage: tail,
        bootstrapUserPrompt: boot,
      }),
    });
  }

  const c = parseBriefSubstanceClassification(parsed);
  return applySubstanceGate({
    mergedBriefRaw: raw,
    tailUserMessage: tail,
    bootstrapUserPrompt: boot,
    inner: c,
  });
}

function applySubstanceGate(params: {
  mergedBriefRaw: string;
  tailUserMessage: string;
  bootstrapUserPrompt: string;
  inner: BriefSubstanceClassification;
}): BriefSubstanceClassification {
  const raw = params.mergedBriefRaw.trim();
  const tail = params.tailUserMessage.trim();
  const boot = params.bootstrapUserPrompt.trim();
  const c = params.inner;
  return {
    mergedBriefFieldSubstantive: raw.length > 0 && c.mergedBriefFieldSubstantive,
    tailSubstantive: tail.length > 0 && c.tailSubstantive,
    bootstrapSubstantive: boot.length > 0 && c.bootstrapSubstantive,
  };
}
