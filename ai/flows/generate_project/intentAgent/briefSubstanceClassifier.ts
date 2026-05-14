import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";

const INPUT_CLIP = 6000;

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

  const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.2, 192, model, {
    langfuseName: lfPlain(LfPlain.commitMergedBriefSubstance),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(meta.content));
  } catch {
    throw new Error(
      `commit_merged_brief_classifier: failed to parse JSON.\nRaw output:\n${meta.content.slice(0, 4000)}`
    );
  }

  const c = parseBriefSubstanceClassification(parsed);
  return {
    mergedBriefFieldSubstantive: raw.length > 0 && c.mergedBriefFieldSubstantive,
    tailSubstantive: tail.length > 0 && c.tailSubstantive,
    bootstrapSubstantive: boot.length > 0 && c.bootstrapSubstantive,
  };
}
