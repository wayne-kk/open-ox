import { getModelId } from "@/lib/config/models";
import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import { chatCompletion } from "./gateway";
import { throwClassifiedLLMError } from "./errorClassifier";
import type { AgentToolCallRecord, ChatMessage } from "./types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export async function callLLMWithTools(params: {
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];
  temperature?: number;
  maxIterations?: number;
  model?: string;
  thinkingLevel?: string;
  executeToolOverrides?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>>;
  /** Optional: called for every message added to the conversation history. Use to collect full trajectory. */
  onMessage?: (msg: ChatMessage) => void;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const {
    systemPrompt,
    userMessage,
    tools,
    temperature = 0.1,
    maxIterations = 8,
    executeToolOverrides = {},
  } = params;
  const model = params.model || getModelId();
  let activeTools = tools;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const toolCalls: AgentToolCallRecord[] = [];
  const emit = params.onMessage;
  if (emit) { emit(messages[0]); emit(messages[1]); }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let res;
    try {
      res = await chatCompletion({
        model,
        messages,
        temperature,
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      const shouldDisableTools =
        activeTools.length > 0 &&
        (msg.includes("LLM HTTP 400") ||
          msgLower.includes("upstream_error") ||
          msgLower.includes("bad_response_status_code"));

      if (shouldDisableTools) {
        console.warn(
          `[callLLMWithTools] model=${model} rejected tool payload; fallback to plain completion.`
        );
        activeTools = [];
        continue;
      }
      throwClassifiedLLMError(err, model);
    }

    const message = res.choices[0]?.message;
    if (!message) break;

    if (res.choices[0]?.finish_reason === "length") {
      throw new Error(
        `LLM response truncated (finish_reason=length) at iteration ${iteration}. Reduce prompt size or increase max_tokens.`
      );
    }

    messages.push(message as unknown as ChatMessage);
    emit?.(message as unknown as ChatMessage);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { content: message.content?.trim() ?? "", toolCalls };
    }

    for (const toolCall of message.tool_calls) {
      const rawArgs = toolCall.function.arguments ?? "{}";
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      const overrideFn = executeToolOverrides[toolCall.function.name];
      const result = overrideFn
        ? await overrideFn(parsedArgs)
        : await executeSystemTool(toolCall.function.name, parsedArgs);

      toolCalls.push({ name: toolCall.function.name, args: parsedArgs, result });
      const toolMsg: ChatMessage = {
        role: "tool",
        tool_call_id: toolCall.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      };
      messages.push(toolMsg);
      emit?.(toolMsg);
    }
  }

  console.warn(
    `[callLLMWithTools] maxIterations (${maxIterations}) exhausted without a final response. Returning last tool call results.`
  );
  return { content: "", toolCalls };
}

/**
 * Multi-turn tool loop starting from an existing message list (e.g. resumable agent sessions).
 * Mutates and returns the same `messages` array (append-only).
 */
export async function callLLMWithToolsFromMessages(params: {
  messages: ChatMessage[];
  tools: ChatCompletionTool[];
  temperature?: number;
  maxIterations?: number;
  model?: string;
  thinkingLevel?: string;
  executeToolOverrides?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>>;
  onMessage?: (msg: ChatMessage) => void;
  /** If set, invoked after each tool result is appended; return true to stop before the next LLM call. */
  shouldAbortAfterToolResults?: () => boolean;
  /**
   * When true, throw immediately if the model rejects the tool payload (HTTP 400)
   * instead of silently falling back to a plain completion (which renders the
   * agent unable to use any tools for the rest of the session).
   */
  requireTools?: boolean;
  /**
   * Called once when the iteration count crosses ~80 % of maxIterations.
   * Receives the live `messages` array — push additional ChatMessage items
   * (e.g. a system nudge) to steer the model toward wrapping up.
   */
  onApproachingLimit?: (context: {
    iteration: number;
    maxIterations: number;
    messages: ChatMessage[];
  }) => void;
  /** Called after each tool execution completes. Use for progress tracking / UI updates. */
  onToolCall?: (info: {
    name: string;
    args: Record<string, unknown>;
    iteration: number;
  }) => void;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const {
    messages,
    tools,
    temperature = 0.1,
    maxIterations = 12,
    executeToolOverrides = {},
    shouldAbortAfterToolResults,
  } = params;
  const model = params.model || getModelId();
  const requireTools = params.requireTools ?? false;
  const onApproachingLimit = params.onApproachingLimit;
  let activeTools = tools;
  const toolCalls: AgentToolCallRecord[] = [];
  const emit = params.onMessage;

  let lastAssistantContent = "";
  let approachingLimitFired = false;
  const limitThreshold = Math.floor(maxIterations * 0.8);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    // Fire the approaching-limit callback once
    if (
      onApproachingLimit &&
      !approachingLimitFired &&
      iteration >= limitThreshold
    ) {
      approachingLimitFired = true;
      onApproachingLimit({ iteration, maxIterations, messages });
    }

    let res;
    try {
      res = await chatCompletion({
        model,
        messages,
        temperature,
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      const shouldDisableTools =
        activeTools.length > 0 &&
        (msg.includes("LLM HTTP 400") ||
          msgLower.includes("upstream_error") ||
          msgLower.includes("bad_response_status_code"));

      if (shouldDisableTools) {
        if (requireTools) {
          throw new Error(
            `Model "${model}" rejected the tool-calling payload (HTTP 400). ` +
              `This agent requires tool support — verify the model is compatible. ` +
              `Detail: ${msg.slice(0, 300)}`
          );
        }
        console.warn(
          `[callLLMWithToolsFromMessages] model=${model} rejected tool payload; fallback to plain completion.`
        );
        activeTools = [];
        continue;
      }
      throwClassifiedLLMError(err, model);
    }

    const message = res.choices[0]?.message;
    if (!message) break;

    if (res.choices[0]?.finish_reason === "length") {
      throw new Error(
        `LLM response truncated (finish_reason=length) at iteration ${iteration}. Reduce prompt size or increase max_tokens.`
      );
    }

    messages.push(message as unknown as ChatMessage);
    emit?.(message as unknown as ChatMessage);

    // Track last non-empty assistant text for diagnostics / fallback
    if (typeof message.content === "string" && message.content.trim()) {
      lastAssistantContent = message.content.trim();
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { content: message.content?.trim() ?? lastAssistantContent, toolCalls };
    }

    for (const toolCall of message.tool_calls) {
      const rawArgs = toolCall.function.arguments ?? "{}";
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      const overrideFn = executeToolOverrides[toolCall.function.name];
      const result = overrideFn
        ? await overrideFn(parsedArgs)
        : await executeSystemTool(toolCall.function.name, parsedArgs);

      toolCalls.push({ name: toolCall.function.name, args: parsedArgs, result });
      params.onToolCall?.({ name: toolCall.function.name, args: parsedArgs, iteration });
      const toolMsg: ChatMessage = {
        role: "tool",
        tool_call_id: toolCall.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      };
      messages.push(toolMsg);
      emit?.(toolMsg);
    }

    if (shouldAbortAfterToolResults?.()) {
      return { content: lastAssistantContent, toolCalls };
    }
  }

  console.warn(
    `[callLLMWithToolsFromMessages] maxIterations (${maxIterations}) exhausted ` +
      `without a final assistant message. model=${model}, toolCalls=${toolCalls.length}`
  );
  return { content: lastAssistantContent, toolCalls };
}
