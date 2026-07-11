import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";
import { DRAFT_FALLBACK_MIN, SUBSTANTIVE_MIN } from "./commitMergeBrief";

const INPUT_CLIP = 6000;

/** Enough headroom when the step uses a reasoning/thinking-capable model (192 was truncating JSON). */
const CLASSIFIER_OUTPUT_MAX_TOKENS = 4096;

/** Pure confirm / go-ahead cues — no new product requirements. */
const PURE_CONFIRM_RE =
  /^(好的?|可以|行|没问题|就这样|就按这个|确认|开始(生成)?(吧|吧！|！)?|生成吧|生成|ok|okay|go|yes|yep|sure|lgtm|do\s*it)[\s!！。.~…]*$/i;

/** Tail ends with a generate/confirm cue (brand name + 「开始生成吧」 etc.). */
const CONFIRM_TAIL_CUE_RE =
  /(开始生成(吧|吧！|！)?|生成吧|就这样(吧)?|确认(生成)?|可以生成了?)[\s!！。.~…]*$/i;

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

/** Empty or pure go-ahead phrase with no new brief content. */
export function isProceduralConfirmTail(tail: string): boolean {
  const t = tail.trim();
  if (!t) return true;
  return PURE_CONFIRM_RE.test(t);
}

/**
 * Short message that ends with a confirm/generate cue.
 * Used when `merged_brief` is already substantive so we can skip the classifier LLM.
 */
export function isConfirmHeavyTail(tail: string): boolean {
  const t = tail.trim();
  if (!t) return true;
  if (isProceduralConfirmTail(t)) return true;
  if (t.length > 96) return false;
  return CONFIRM_TAIL_CUE_RE.test(t);
}

/**
 * Fast-path without LLM when the merge decision is already clear from lengths + confirm cues.
 * Exported for unit tests.
 */
export function tryBriefSubstanceHeuristicFastPath(params: {
  mergedBriefRaw: string;
  tailUserMessage: string;
  bootstrapUserPrompt: string;
}): BriefSubstanceClassification | null {
  const raw = params.mergedBriefRaw.trim();
  const tail = params.tailUserMessage.trim();
  const boot = params.bootstrapUserPrompt.trim();

  const heuristic = briefSubstanceHeuristicLengths({
    mergedBriefRaw: raw,
    tailUserMessage: tail,
    bootstrapUserPrompt: boot,
  });

  // Classic case: brief + bootstrap ready, tail too short to be a new brief.
  if (
    heuristic.mergedBriefFieldSubstantive &&
    heuristic.bootstrapSubstantive &&
    !heuristic.tailSubstantive
  ) {
    return heuristic;
  }

  // Pure confirm when either merged brief or bootstrap already carries the brief.
  if (
    (heuristic.mergedBriefFieldSubstantive || heuristic.bootstrapSubstantive) &&
    isProceduralConfirmTail(tail)
  ) {
    return {
      mergedBriefFieldSubstantive: heuristic.mergedBriefFieldSubstantive,
      tailSubstantive: false,
      bootstrapSubstantive: heuristic.bootstrapSubstantive,
    };
  }

  // 「品牌名叫 X，开始生成吧」while commit tool already wrote a full merged_brief —
  // skip LLM; keep length-based tail flag so short brand addenda can still merge if needed.
  if (heuristic.mergedBriefFieldSubstantive && isConfirmHeavyTail(tail)) {
    return {
      mergedBriefFieldSubstantive: true,
      // Short brand+confirm stays non-substantive by length; longer tails keep length gate.
      tailSubstantive: heuristic.tailSubstantive,
      bootstrapSubstantive: heuristic.bootstrapSubstantive,
    };
  }

  return null;
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

  const fast = tryBriefSubstanceHeuristicFastPath({
    mergedBriefRaw: raw,
    tailUserMessage: tail,
    bootstrapUserPrompt: boot,
  });
  if (fast) {
    return applySubstanceGate({
      mergedBriefRaw: raw,
      tailUserMessage: tail,
      bootstrapUserPrompt: boot,
      inner: fast,
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
