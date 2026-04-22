import type { LLMCallResult } from "./llm";
import type { StepTrace } from "../types";

/** Build a StepTrace fragment with standard LLM fields for the Studio detail drawer. */
export function stepTraceFromLlmCompletion(
  systemPrompt: string,
  userMessage: string,
  meta: LLMCallResult
): StepTrace {
  return {
    llmCall: {
      model: meta.model,
      systemPrompt,
      userMessage,
      rawResponse: meta.content,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
    },
  };
}
