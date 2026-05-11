import { getModelId } from "../../../../lib/config/models";
import { chatCompletion } from "@/ai/shared/llm/gateway";
import { callLLMWithTools, callLLMWithToolsFromMessages } from "@/ai/shared/llm/toolLoop";
import { throwClassifiedLLMError } from "@/ai/shared/llm/errorClassifier";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";

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
  const resolvedModel = model || getModelId();
  try {
    const res = await chatCompletion({
      model: resolvedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      ...(maxTokens != null && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
      langfuseGenerationName: observability?.langfuseName ?? lfPlain(LfPlain.unspecified),
    });

    const content = res.choices[0]?.message?.content?.trim() ?? "";
    if (!content && res.choices[0]?.finish_reason === "length") {
      throw new Error(`LLM response truncated (max_tokens reached). Model: ${resolvedModel}`);
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
