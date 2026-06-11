import { getModelId, type StepThinkingLevel } from "../../../../lib/config/models";
import { chatCompletion } from "@/ai/shared/llm/gateway";
import { callLLMWithTools, callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { throwClassifiedLLMError } from "@/ai/shared/llm/errorClassifier";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import type { ChatMessageContent } from "@/ai/shared/llm/types";

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
  /** Gemini-compatible gateways: caps hidden reasoning so visible output keeps budget. */
  thinkingLevel?: StepThinkingLevel;
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
      ...(observability?.thinkingLevel ? { thinking_level: observability.thinkingLevel } : {}),
      langfuseGenerationName: observability?.langfuseName ?? lfPlain(LfPlain.unspecified),
    });

    const content = res.choices[0]?.message?.content?.trim() ?? "";
    if (!content && res.choices[0]?.finish_reason === "length") {
      const reasoningTokens = (
        res.usage as { completion_tokens_details?: { reasoning_tokens?: number } } | undefined
      )?.completion_tokens_details?.reasoning_tokens;
      const reasoningHint =
        reasoningTokens != null && reasoningTokens > 0
          ? ` Hidden reasoning consumed ~${reasoningTokens} completion tokens before any visible CSS/text was emitted.`
          : "";
      throw new Error(
        `LLM response truncated (max_tokens reached; visible content empty).${reasoningHint} Model: ${resolvedModel}`
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
