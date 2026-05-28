import { getModelId } from "../../../../lib/config/models";
import { chatCompletion } from "@/ai/shared/llm/gateway";
import { callLLMWithTools, callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { throwClassifiedLLMError } from "@/ai/shared/llm/errorClassifier";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessageContent } from "@/ai/shared/llm/types";
import {
  normalizeAssistantTextContent,
} from "@/ai/shared/llm/normalizeAssistantContent";

const LLM_TRUNCATION_DIAG_PREVIEW_CHARS = 2_400;

function summarizeRawAssistantContent(raw: unknown): {
  kind: string;
  preview: string;
  arrayLength?: number;
} {
  if (raw === undefined) return { kind: "undefined", preview: "" };
  if (raw === null) return { kind: "null", preview: "" };
  if (typeof raw === "string") {
    const p =
      raw.length <= LLM_TRUNCATION_DIAG_PREVIEW_CHARS
        ? raw
        : `${raw.slice(0, LLM_TRUNCATION_DIAG_PREVIEW_CHARS)}… (${raw.length} chars total)`;
    return { kind: "string", preview: p };
  }
  if (Array.isArray(raw)) {
    const s = JSON.stringify(raw);
    return {
      kind: "array",
      arrayLength: raw.length,
      preview:
        s.length <= LLM_TRUNCATION_DIAG_PREVIEW_CHARS
          ? s
          : `${s.slice(0, LLM_TRUNCATION_DIAG_PREVIEW_CHARS)}… (${s.length} JSON chars total)`,
    };
  }
  const s = String(raw);
  return {
    kind: typeof raw,
    preview: s.length <= LLM_TRUNCATION_DIAG_PREVIEW_CHARS ? s : `${s.slice(0, LLM_TRUNCATION_DIAG_PREVIEW_CHARS)}…`,
  };
}

/** Long provider-specific assistant fields — log keys + short previews only. */
function assistantMessageAsidePreviews(message: Record<string, unknown>): Record<string, string> {
  const asideKeys = ["reasoning", "thinking", "reasoning_content", "thought"];
  const out: Record<string, string> = {};
  for (const k of asideKeys) {
    const v = message[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const t = v.trim();
    out[k] =
      t.length <= 800 ? t : `${t.slice(0, 800)}… (${t.length} chars total)`;
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    out.tool_calls_note = `${message.tool_calls.length} tool call(s) present`;
  }
  return out;
}

function logTruncationDiagnostics(params: {
  where: string;
  model: string;
  langfuseName?: string;
  finishReason: string | undefined;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | undefined;
  rawMsg: Record<string, unknown> | undefined;
  normalizedLen: number;
}): void {
  const raw = params.rawMsg?.content;
  const rawSummary = summarizeRawAssistantContent(raw);
  const messageKeys =
    params.rawMsg && typeof params.rawMsg === "object" ? Object.keys(params.rawMsg) : [];
  const aside = params.rawMsg ? assistantMessageAsidePreviews(params.rawMsg) : {};

  console.error(
    `[LLM truncation diagnostic:${params.where}]`,
    JSON.stringify(
      {
        model: params.model,
        langfuseGenerationName: params.langfuseName ?? null,
        finish_reason: params.finishReason ?? null,
        usage: params.usage ?? null,
        normalizedTextLength: params.normalizedLen,
        rawMessageContent: rawSummary,
        assistantMessageKeys: messageKeys,
        assistantAsidePreviews: Object.keys(aside).length > 0 ? aside : undefined,
      },
      null,
      2,
    ),
  );
}

export { extractContent, extractJSON } from "@/ai/shared/llm/contentExtractors";
export type {
  ChatMessageContent,
  ChatMessage,
  ChatCompletionResponse,
  AgentToolCallRecord,
} from "@/ai/shared/llm/types";
export { chatCompletion, callLLMWithTools, callLLMWithToolsFromMessages };

export type CallLLMObservability = {
  /** Use {@link lfPlain} + {@link LfPlain} for stable Langfuse names. */
  langfuseName: string;
};

export interface LLMCallResult {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  maxTokens?: number,
  model?: string,
  observability?: CallLLMObservability
): Promise<string> {
  return (await callLLMWithMeta(systemPrompt, userMessage, temperature, maxTokens, model, observability))
    .content;
}

export async function callLLMWithMeta(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  maxTokens?: number,
  model?: string,
  observability?: CallLLMObservability
): Promise<LLMCallResult> {
  return callLLMWithMetaUserContent(
    systemPrompt,
    userMessage,
    temperature,
    maxTokens,
    model,
    observability
  );
}

/**
 * Like {@link callLLMWithMeta} but supports vision via multimodal `user` content.
 * Langfuse/traces still receive string snapshots where needed.
 */
export async function callLLMWithMetaUserContent(
  systemPrompt: string,
  userContent: ChatMessageContent,
  temperature = 0.7,
  maxTokens?: number,
  model?: string,
  observability?: CallLLMObservability
): Promise<LLMCallResult> {
  const resolvedModel = model || getModelId();
  try {
    const res = await chatCompletion({
      model: resolvedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature,
      ...(maxTokens != null && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
      langfuseGenerationName: observability?.langfuseName ?? lfPlain(LfPlain.unspecified),
    });

    const rawMsg = res.choices[0]?.message;
    const content = normalizeAssistantTextContent(rawMsg?.content);
    const finish = res.choices[0]?.finish_reason;
    if (!content && finish === "length") {
      logTruncationDiagnostics({
        where: "callLLMWithMetaUserContent",
        model: resolvedModel,
        langfuseName: observability?.langfuseName,
        finishReason: finish,
        usage: res.usage,
        rawMsg: rawMsg as Record<string, unknown> | undefined,
        normalizedLen: content.length,
      });
      throw new Error(
        `LLM response truncated (output limit reached). Model: ${resolvedModel}. ` +
          "If you use Gemini via OpenAI-compatible proxies, the gateway must send max_completion_tokens (this repo maps it for model ids containing \"gemini\")."
      );
    }

    return {
      content,
      model: resolvedModel,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
  } catch (err: unknown) {
    throwClassifiedLLMError(err, resolvedModel);
  }
}
