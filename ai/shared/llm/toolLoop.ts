import { getModelId } from "@/lib/config/models";
import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import { chatCompletion } from "./gateway";
import { throwClassifiedLLMError } from "./errorClassifier";
import type { AgentToolCallRecord, ChatMessage, ChatMessageContent } from "./types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { lfToolAgentRound } from "@/lib/observability/langfuseGenerationCatalog";

export type ToolLoopToolChoice = "required" | "auto" | "none";

export interface FormatToolResultForModelParams {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult | string;
  iteration: number;
}

function extractReasoningFromAssistantMessage(msg: unknown): string | null {
  if (!msg || typeof msg !== "object") return null;
  const o = msg as Record<string, unknown>;
  for (const k of ["reasoning", "thinking", "reasoning_content", "thought"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function resolveToolLoopPhase(
  explicit: string | undefined,
  legacyLabel: string | undefined,
  defaultSlug: string
): string {
  const raw = explicit ?? legacyLabel ?? defaultSlug;
  return raw.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || defaultSlug;
}

export async function callLLMWithTools(params: {
  systemPrompt: string;
  userMessage: string;
  /** When set, used as the first user turn instead of `userMessage` (for vision). */
  userContent?: ChatMessageContent;
  tools: ChatCompletionTool[];
  temperature?: number;
  maxIterations?: number;
  /** Cap completion tokens per round (avoids truncated JSON on long userProvidedContent). */
  maxTokens?: number;
  /** When false, the model may only call one tool per turn (helps long URL tool args). */
  parallelToolCalls?: boolean;
  model?: string;
  thinkingLevel?: string;
  executeToolOverrides?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>>;
  /** Optional: called for every message added to the conversation history. */
  onMessage?: (msg: ChatMessage) => void;
  /**
   * Langfuse: stable phase slug for {@link lfToolAgentRound}, e.g.
   * {@link import("@/lib/observability/langfuseGenerationCatalog").LfToolPhase}.
   */
  langfusePhase?: string;
  /** @deprecated Prefer `langfusePhase`; kept for call-site compatibility */
  langfuseAgentLabel?: string;
  langfuseGenerationMetadata?: Record<string, unknown>;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const {
    systemPrompt,
    userMessage,
    userContent,
    tools,
    temperature = 0.1,
    maxIterations = 8,
    executeToolOverrides = {},
  } = params;
  const model = params.model || getModelId();
  let activeTools = tools;
  const firstUserContent = userContent !== undefined ? userContent : userMessage;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: firstUserContent },
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
        ...(params.maxTokens != null && params.maxTokens > 0
          ? { max_tokens: params.maxTokens }
          : {}),
        ...(params.parallelToolCalls === false ? { parallel_tool_calls: false } : {}),
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
        langfuseGenerationName: lfToolAgentRound(
          resolveToolLoopPhase(params.langfusePhase, params.langfuseAgentLabel, "tool_prompt_tools"),
          iteration
        ),
        langfuseGenerationMetadata: {
          iteration: iteration + 1,
          ...params.langfuseGenerationMetadata,
        },
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

    await dispatchToolCalls({
      toolCalls,
      messages,
      message,
      executeToolOverrides,
      emit,
      iteration,
    });
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
  /** When false, the model may only call one tool per turn. */
  parallelToolCalls?: boolean;
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
    result: ToolResult | string;
  }) => void;
  /** Model extended/thinking fields surfaced as text (provider-dependent). */
  onReasoning?: (info: { iteration: number; text: string }) => void;
  /** Each assistant message before tool execution (tool names + short text preview). */
  onAssistantRound?: (info: {
    iteration: number;
    textPreview: string | null;
    toolCallNames: string[];
  }) => void;
  langfusePhase?: string;
  /** @deprecated Prefer `langfusePhase` */
  langfuseAgentLabel?: string;
  langfuseGenerationMetadata?: Record<string, unknown>;
  /** Optional per-iteration tool subset (e.g. batch-write first round). */
  resolveToolsForIteration?: (
    iteration: number,
    defaultTools: ChatCompletionTool[]
  ) => ChatCompletionTool[];
  /** Optional per-iteration tool_choice (defaults to auto when tools present). */
  resolveToolChoiceForIteration?: (
    iteration: number,
    toolsForRound: ChatCompletionTool[]
  ) => ToolLoopToolChoice | undefined;
  /** Shrink tool role message content sent back to the model on the next turn. */
  formatToolResultForModel?: (info: FormatToolResultForModelParams) => string;
  /** Mutate messages before each LLM round (e.g. compact stale tool history). */
  compactMessagesBeforeRound?: (context: {
    iteration: number;
    maxIterations: number;
    messages: ChatMessage[];
  }) => void;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const {
    messages,
    tools,
    temperature = 0.5,
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
    params.compactMessagesBeforeRound?.({ iteration, maxIterations, messages });

    const toolsForRound = params.resolveToolsForIteration?.(iteration, tools) ?? tools;
    activeTools = toolsForRound;

    const toolChoice =
      activeTools.length > 0
        ? (params.resolveToolChoiceForIteration?.(iteration, activeTools) ?? "auto")
        : undefined;

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
        ...(params.parallelToolCalls === false ? { parallel_tool_calls: false } : {}),
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? toolChoice : undefined,
        ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
        langfuseGenerationName: lfToolAgentRound(
          resolveToolLoopPhase(params.langfusePhase, params.langfuseAgentLabel, "tool_prompt_messages"),
          iteration
        ),
        langfuseGenerationMetadata: {
          iteration: iteration + 1,
          ...params.langfuseGenerationMetadata,
        },
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

    const reasoningText = extractReasoningFromAssistantMessage(message);
    if (reasoningText && params.onReasoning) {
      params.onReasoning({ iteration, text: reasoningText });
    }
    const toolCallNames =
      message.tool_calls
        ?.map((tc) => tc.function?.name)
        .filter((n): n is string => typeof n === "string" && n.length > 0) ?? [];
    params.onAssistantRound?.({
      iteration,
      textPreview:
        typeof message.content === "string" && message.content.trim()
          ? message.content.trim().slice(0, 900)
          : null,
      toolCallNames,
    });

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { content: message.content?.trim() ?? lastAssistantContent, toolCalls };
    }

    await dispatchToolCalls({
      toolCalls,
      messages,
      message,
      executeToolOverrides,
      emit,
      iteration,
      onToolCall: params.onToolCall,
      formatToolResultForModel: params.formatToolResultForModel,
    });

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

/**
 * Tools that **must** run serially within a round because they mutate
 * shared global state (npm registry / package.json / lockfile, the
 * site-root pointer, etc.). When any of these appear in a single
 * `tool_calls` batch, the whole batch falls back to serial execution
 * to preserve the previous safe semantics.
 */
const SERIAL_ONLY_TOOLS = new Set<string>([
  "install_package",
  "exec_shell",
]);

interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

function parseToolCall(toolCall: {
  id: string;
  function: { name: string; arguments?: string };
}): ParsedToolCall {
  const rawArgs = toolCall.function.arguments ?? "{}";
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
  } catch {
    parsedArgs = {};
  }
  return { id: toolCall.id, name: toolCall.function.name, args: parsedArgs };
}

async function executeOne(
  call: ParsedToolCall,
  executeToolOverrides: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  >
): Promise<ToolResult | string> {
  const overrideFn = executeToolOverrides[call.name];
  return overrideFn
    ? await overrideFn(call.args)
    : await executeSystemTool(call.name, call.args);
}

/**
 * Execute every tool_call in an assistant message and append matching tool
 * messages to the conversation. Calls are run **in parallel** when the batch
 * has no SERIAL_ONLY_TOOLS, since most tools (read_file, write_file with
 * distinct paths, list_dir, search_code, format_code, think) are independent
 * I/O. The tool messages are appended in the original `tool_calls` order so
 * the model still sees the deterministic correlation it expects.
 */
async function dispatchToolCalls(params: {
  toolCalls: AgentToolCallRecord[];
  messages: ChatMessage[];
  message: { tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> };
  executeToolOverrides: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  >;
  emit?: (msg: ChatMessage) => void;
  iteration: number;
  onToolCall?: (info: {
    name: string;
    args: Record<string, unknown>;
    result: ToolResult | string;
    iteration: number;
  }) => void;
  formatToolResultForModel?: (info: FormatToolResultForModelParams) => string;
}): Promise<void> {
  const {
    toolCalls,
    messages,
    message,
    executeToolOverrides,
    emit,
    onToolCall,
    iteration,
    formatToolResultForModel,
  } = params;
  const calls = (message.tool_calls ?? []).map(parseToolCall);
  if (calls.length === 0) return;

  const serializeForModel = (
    call: ParsedToolCall,
    result: ToolResult | string
  ): string => {
    if (formatToolResultForModel) {
      return formatToolResultForModel({
        name: call.name,
        args: call.args,
        result,
        iteration,
      });
    }
    return typeof result === "string" ? result : JSON.stringify(result);
  };

  const requiresSerial =
    calls.length === 1 || calls.some((c) => SERIAL_ONLY_TOOLS.has(c.name));

  if (requiresSerial) {
    for (const call of calls) {
      const result = await executeOne(call, executeToolOverrides);
      toolCalls.push({ name: call.name, args: call.args, result });
      onToolCall?.({ name: call.name, args: call.args, result, iteration });
      const toolMsg: ChatMessage = {
        role: "tool",
        tool_call_id: call.id,
        content: serializeForModel(call, result),
      };
      messages.push(toolMsg);
      emit?.(toolMsg);
    }
    return;
  }

  // Parallel path: kick off every tool call, then commit results in the
  // original order so message ordering remains deterministic regardless
  // of which tool finishes first.
  const settled = await Promise.all(
    calls.map(async (call) => {
      try {
        const result = await executeOne(call, executeToolOverrides);
        return { call, result };
      } catch (err) {
        const errorResult: ToolResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
        return { call, result: errorResult };
      }
    })
  );

  for (const { call, result } of settled) {
    toolCalls.push({ name: call.name, args: call.args, result });
    onToolCall?.({ name: call.name, args: call.args, result, iteration });
    const toolMsg: ChatMessage = {
      role: "tool",
      tool_call_id: call.id,
      content: serializeForModel(call, result),
    };
    messages.push(toolMsg);
    emit?.(toolMsg);
  }
}
