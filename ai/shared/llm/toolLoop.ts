import { getAllModels, getModelId } from "@/lib/config/models";
import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import { chatCompletion } from "./gateway";
import { throwClassifiedLLMError } from "./errorClassifier";
import type {
  AgentToolCallRecord,
  ChatCompletionResponse,
  ChatMessage,
  ChatMessageContent,
} from "./types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { lfToolAgentRound } from "@/lib/observability/langfuseGenerationCatalog";
import { createAgentContext, InMemoryContextEventStore, isAgentContextV2Enabled } from "@/ai/shared/agentContext";
import type { ContextSessionKind } from "@/ai/shared/agentContext";
import type { DurableTaskState } from "@/ai/shared/agentContext";
import { legacyMessagesToEvents } from "@/ai/shared/agentContext/legacyMessages";
import { resolveLlmProvider } from "./providerAdapter";

export type ToolLoopToolChoice = "required" | "auto" | "none";
export type ToolLoopCompletionProfile = "control" | "code";

const TOOL_LOOP_COMPLETION_TOKENS: Record<ToolLoopCompletionProfile, number> = {
  control: 8_192,
  code: 16_384,
};
const LENGTH_RETRY_TOOL_CONTENT_MAX_CHARS = 24_000;
const PROACTIVE_OLD_TOOL_CONTENT_MAX_CHARS = 500;
const PROACTIVE_RECENT_TOOL_MESSAGES = 6;
const CONTEXT_WINDOW_SAFETY_TOKENS = 1_024;
const MIN_COMPLETION_TOKENS = 1_024;
const VISION_TOKEN_ESTIMATE = { low: 1_024, auto: 2_048, high: 4_096 } as const;
const SOURCE_MUTATION_TOOL_NAMES = new Set([
  "write_file",
  "edit_file",
  "create_file",
  "apply_file_patch",
  "replace_file",
  "create_target_page",
  "create_page_component",
  "replace_page_file",
  "create_chrome_layout",
  "create_chrome_component",
  "replace_chrome_file",
]);

function estimateTextTokens(value: string): number {
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const character of value) {
    if (character.codePointAt(0)! <= 0x7f) asciiCharacters += 1;
    else nonAsciiCharacters += 1;
  }
  // Source code and JSON average roughly 3–4 ASCII characters per token.
  // CJK and other non-ASCII scripts can approach one code point per token.
  return Math.ceil(asciiCharacters / 3 + nonAsciiCharacters);
}

function estimateMessageTokens(message: ChatMessage): number {
  const { content, ...metadata } = message;
  let estimate = estimateTextTokens(JSON.stringify(metadata));
  if (typeof content === "string") return estimate + estimateTextTokens(content);
  if (!Array.isArray(content)) return estimate;

  for (const part of content) {
    if (part.type === "text") {
      estimate += estimateTextTokens(part.text);
      continue;
    }
    estimate += VISION_TOKEN_ESTIMATE[part.image_url.detail ?? "auto"];
  }
  return estimate;
}

function resolveCompletionMaxTokens(
  profile: ToolLoopCompletionProfile | undefined,
  model: string,
  messages: ChatMessage[],
  tools: ChatCompletionTool[],
): number | undefined {
  if (!profile) return undefined;
  const profileTokens = TOOL_LOOP_COMPLETION_TOKENS[profile];
  const contextWindow = getAllModels().find(
    (candidate) => candidate.id === model,
  )?.contextWindow;
  if (!contextWindow) return profileTokens;
  // Image data URLs use a fixed vision estimate because providers do not
  // tokenize their base64 payload as prompt text.
  const estimatedPromptTokens =
    messages.reduce(
      (total, message) => total + estimateMessageTokens(message),
      0,
    ) + estimateTextTokens(JSON.stringify(tools));
  const availableCompletionTokens =
    contextWindow - estimatedPromptTokens - CONTEXT_WINDOW_SAFETY_TOKENS;
  if (availableCompletionTokens < MIN_COMPLETION_TOKENS) {
    throw new Error(
      `Insufficient completion budget for model "${model}": ` +
        `estimated_prompt_tokens=${estimatedPromptTokens}, context_window=${contextWindow}, ` +
        `available_completion_tokens=${availableCompletionTokens}, minimum=${MIN_COMPLETION_TOKENS}. ` +
        `Compact the conversation history before retrying.`,
    );
  }
  return Math.min(profileTokens, availableCompletionTokens);
}

interface ToolHistoryCallSummary {
  id: string;
  name: string;
  path?: string;
  argumentLength: number;
}

function parseToolHistoryCall(value: unknown): ToolHistoryCallSummary | null {
  if (!value || typeof value !== "object") return null;
  const call = value as Record<string, unknown>;
  const fn = call.function;
  if (typeof call.id !== "string" || !fn || typeof fn !== "object") return null;
  const fnRecord = fn as Record<string, unknown>;
  if (typeof fnRecord.name !== "string" || typeof fnRecord.arguments !== "string") {
    return null;
  }
  let path: string | undefined;
  try {
    const parsed = JSON.parse(fnRecord.arguments) as unknown;
    if (parsed && typeof parsed === "object") {
      const parsedPath = (parsed as Record<string, unknown>).path;
      if (typeof parsedPath === "string" && parsedPath.trim()) {
        path = parsedPath.trim();
      }
    }
  } catch {
    // Malformed calls remain untouched so the model can see the failed input.
  }
  return {
    id: call.id,
    name: fnRecord.name,
    path,
    argumentLength: fnRecord.arguments.length,
  };
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hasDiagnostics(value: unknown): boolean {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.diagnostics) && record.diagnostics.length > 0) {
    return true;
  }
  return record.output !== undefined && hasDiagnostics(record.output);
}

function toolResultCanBeSummarized(content: unknown): boolean {
  let value = content;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return false;
    }
  }
  if (!value || typeof value !== "object") return false;
  const success = (value as Record<string, unknown>).success;
  return success === true && !hasDiagnostics(value);
}

function summarizeSuccessfulOversizedToolPairs(messages: ChatMessage[]): ChatMessage[] {
  const summarizableResultsByCallId = new Map<string, boolean>();
  for (const message of messages) {
    if (message.role !== "tool" || typeof message.tool_call_id !== "string") continue;
    summarizableResultsByCallId.set(
      message.tool_call_id,
      toolResultCanBeSummarized(message.content),
    );
  }

  const summariesByAssistantIndex = new Map<number, string>();
  const collapsedCallIds = new Set<string>();
  messages.forEach((message, index) => {
    if (message.role !== "assistant" || !Array.isArray(message.tool_calls)) return;
    const calls = message.tool_calls.map(parseToolHistoryCall);
    if (calls.some((call) => call === null)) return;
    const validCalls = calls.filter((call): call is ToolHistoryCallSummary => call !== null);
    if (
      validCalls.length === 0 ||
      !validCalls.some(
        (call) => call.argumentLength > LENGTH_RETRY_TOOL_CONTENT_MAX_CHARS,
      ) ||
      !validCalls.every((call) => summarizableResultsByCallId.get(call.id) === true)
    ) {
      return;
    }

    for (const call of validCalls) collapsedCallIds.add(call.id);
    const operations = validCalls
      .map((call) => `${call.name}${call.path ? ` ${call.path}` : ""}: succeeded`)
      .join("; ");
    summariesByAssistantIndex.set(
      index,
      `[Historical tool operations] ${operations}. Source arguments omitted.`,
    );
  });

  return messages.flatMap((message, index) => {
    const summary = summariesByAssistantIndex.get(index);
    if (summary) return [{ role: "system", content: summary } satisfies ChatMessage];
    if (
      message.role === "tool" &&
      typeof message.tool_call_id === "string" &&
      collapsedCallIds.has(message.tool_call_id)
    ) {
      return [];
    }
    return [message];
  });
}

function compactToolHistoryForRequest(
  messages: ChatMessage[],
  compactOlderToolResults: boolean,
): ChatMessage[] {
  const summarizedMessages = summarizeSuccessfulOversizedToolPairs(messages);
  const toolMessageCount = summarizedMessages.filter(
    (message) => message.role === "tool",
  ).length;
  let toolMessageIndex = 0;

  return summarizedMessages.map((message) => {
    if (message.role !== "tool" || typeof message.content !== "string") {
      return message;
    }
    const isOlderToolResult =
      compactOlderToolResults &&
      toolMessageIndex < toolMessageCount - PROACTIVE_RECENT_TOOL_MESSAGES;
    toolMessageIndex += 1;
    const maxChars = isOlderToolResult
      ? PROACTIVE_OLD_TOOL_CONTENT_MAX_CHARS
      : LENGTH_RETRY_TOOL_CONTENT_MAX_CHARS;
    if (message.content.length <= maxChars) return message;

    return {
      ...message,
      content:
        `${message.content.slice(0, maxChars)}` +
        "\n[Tool result compacted for the next model request]",
    };
  });
}

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
  defaultSlug: string,
): string {
  const raw = explicit ?? legacyLabel ?? defaultSlug;
  return (
    raw.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || defaultSlug
  );
}

function assertRequestEndsWithValidTurn(messages: ChatMessage[]): void {
  const lastConversationalMessage = messages.findLast(
    (message) => message.role !== "system",
  );
  if (lastConversationalMessage?.role !== "assistant") return;

  throw new Error(
    "Invalid conversation history: the request ends with an assistant/model turn. " +
      "Append a user instruction or the matching tool result before requesting another completion.",
  );
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
  executeToolOverrides?: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  >;
  /** Optional: called for every message added to the conversation history. */
  onMessage?: (msg: ChatMessage) => void;
  /** Called after each tool execution completes. */
  onToolCall?: (info: {
    name: string;
    args: Record<string, unknown>;
    iteration: number;
    result: ToolResult | string;
  }) => void;
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
  const firstUserContent =
    userContent !== undefined ? userContent : userMessage;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: firstUserContent },
  ];
  const toolCalls: AgentToolCallRecord[] = [];
  const emit = params.onMessage;
  if (emit) {
    emit(messages[0]);
    emit(messages[1]);
  }

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
        ...(params.parallelToolCalls === false
          ? { parallel_tool_calls: false }
          : {}),
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        ...(params.thinkingLevel
          ? { thinking_level: params.thinkingLevel }
          : {}),
        langfuseGenerationName: lfToolAgentRound(
          resolveToolLoopPhase(
            params.langfusePhase,
            params.langfuseAgentLabel,
            "tool_prompt_tools",
          ),
          iteration,
        ),
        langfuseGenerationMetadata: {
          iteration: iteration + 1,
          ...params.langfuseGenerationMetadata,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      const upstreamWrappedFailure =
        msgLower.includes("upstream_error") || msgLower.includes("bad_response_status_code");
      if (upstreamWrappedFailure) {
        throw new Error(
          `Transient provider upstream failure after gateway retries. Model: ${model}. ` +
            `Detail: ${msg.slice(0, 500)}`,
        );
      }
      const shouldDisableTools =
        activeTools.length > 0 &&
        (msg.includes("LLM HTTP 400") ||
          msgLower.includes("upstream_error") ||
          msgLower.includes("bad_response_status_code"));

      if (shouldDisableTools) {
        console.warn(
          `[callLLMWithTools] model=${model} rejected tool payload; fallback to plain completion.`,
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
        `LLM response truncated (finish_reason=length) at iteration ${iteration}. Reduce prompt size or increase max_tokens.`,
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
      onToolCall: params.onToolCall,
    });
  }

  console.warn(
    `[callLLMWithTools] maxIterations (${maxIterations}) exhausted without a final response. Returning last tool call results.`,
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
  /** Shared output budget tuned for control turns or source-code tool calls. */
  completionProfile?: ToolLoopCompletionProfile;
  /** Typed context identity used by staged AgentContext rollout. */
  contextSessionKind?: ContextSessionKind;
  /** Managed sessions always use AgentContext; rollout sessions follow environment flags. */
  contextMode?: "rollout" | "managed";
  /** Latest server-owned state. Managed AgentContext keeps only the newest projection. */
  resolveTaskStateForRound?: () => DurableTaskState;
  /** When false, the model may only call one tool per turn. */
  parallelToolCalls?: boolean;
  model?: string;
  thinkingLevel?: string;
  executeToolOverrides?: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  >;
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
  /**
   * Let a role worker reject an assistant stop when its deterministic
   * postcondition is not satisfied. Return true after appending a recovery
   * message to continue with the next round.
   */
  onAssistantStop?: (context: {
    iteration: number;
    message: ChatCompletionResponse["choices"][number]["message"];
    messages: ChatMessage[];
  }) => boolean;
  langfusePhase?: string;
  /** @deprecated Prefer `langfusePhase` */
  langfuseAgentLabel?: string;
  langfuseGenerationMetadata?: Record<string, unknown>;
  /** Optional per-iteration tool subset (e.g. batch-write first round). */
  resolveToolsForIteration?: (
    iteration: number,
    defaultTools: ChatCompletionTool[],
  ) => ChatCompletionTool[];
  /** Optional per-iteration tool_choice (defaults to auto when tools present). */
  resolveToolChoiceForIteration?: (
    iteration: number,
    toolsForRound: ChatCompletionTool[],
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
  const phase = resolveToolLoopPhase(
    params.langfusePhase,
    params.langfuseAgentLabel,
    "tool_prompt_messages",
  );
  const configuredModel = getAllModels().find((candidate) => candidate.id === model);
  const contextSessionKind = params.contextSessionKind ?? "page";
  const agentContext = params.completionProfile &&
    (params.contextMode === "managed" || isAgentContextV2Enabled(contextSessionKind))
    ? createAgentContext(
        {
          sessionId: `${phase}:${crypto.randomUUID()}`,
          sessionKind: contextSessionKind,
          policyVersion: "v1",
        },
        { eventStore: new InMemoryContextEventStore() },
      )
    : undefined;
  let syncedMessageCount = 0;
  let lastProjectionThroughEventId: string | undefined;
  let lastTaskStateJson: string | undefined;

  const syncContext = async () => {
    if (!agentContext || syncedMessageCount >= messages.length) return;
    const events = legacyMessagesToEvents(messages, syncedMessageCount);
    if (events.length > 0) await agentContext.append(events);
    syncedMessageCount = messages.length;
  };

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    params.compactMessagesBeforeRound?.({ iteration, maxIterations, messages });

    const toolsForRound =
      params.resolveToolsForIteration?.(iteration, tools) ?? tools;
    activeTools = toolsForRound;

    const toolChoice =
      activeTools.length > 0
        ? (params.resolveToolChoiceForIteration?.(iteration, activeTools) ??
          "auto")
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

    let roundCompletionMaxTokens: number | undefined;
    const requestRound = async (lengthRetry: boolean, providerArgumentRetry = false) => {
      await syncContext();
      const taskState = params.resolveTaskStateForRound?.();
      if (agentContext && taskState) {
        const taskStateJson = JSON.stringify(taskState);
        if (taskStateJson !== lastTaskStateJson) {
          await agentContext.append([{ kind: "task_state", state: taskState }]);
          lastTaskStateJson = taskStateJson;
        }
      }
      const projection = agentContext
        ? await agentContext.project({
            model: {
              id: model,
              provider: model.toLowerCase().includes("gemini") ? "gemini-compatible" : "openai",
              contextWindow: configuredModel?.contextWindow ?? 128_000,
            },
            tools: activeTools,
            toolChoice: toolChoice ?? "none",
            completionProfile: params.completionProfile!,
            pressure: lengthRetry ? "overflow_recovery" : "normal",
          })
        : undefined;
      lastProjectionThroughEventId = projection?.throughEventId;
      const compactedMessages = projection?.messages
        ? [...projection.messages]
        : lengthRetry || params.completionProfile === "code"
          ? compactToolHistoryForRequest(messages, params.completionProfile === "code")
          : messages;
      const requestMessages = compactedMessages;
      assertRequestEndsWithValidTurn(requestMessages);
      roundCompletionMaxTokens = projection?.maxCompletionTokens ?? resolveCompletionMaxTokens(
        params.completionProfile, model, requestMessages, activeTools,
      );
      return chatCompletion({
        model,
        messages: requestMessages,
        temperature,
        ...(roundCompletionMaxTokens
          ? { max_tokens: roundCompletionMaxTokens }
          : {}),
        ...(!providerArgumentRetry && lengthRetry
          ? { parallel_tool_calls: false }
          : !providerArgumentRetry && params.parallelToolCalls === false
            ? { parallel_tool_calls: false }
            : {}),
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 && !providerArgumentRetry ? toolChoice : undefined,
        ...(!providerArgumentRetry && lengthRetry
          ? { thinking_level: "minimal" }
          : !providerArgumentRetry && params.thinkingLevel
            ? { thinking_level: params.thinkingLevel }
            : {}),
        langfuseGenerationName: `${lfToolAgentRound(phase, iteration)}${
          lengthRetry ? ".length_retry_1" : providerArgumentRetry ? ".provider_argument_retry_1" : ""
        }`,
        langfuseGenerationMetadata: {
          iteration: iteration + 1,
          lengthRetry: lengthRetry ? 1 : 0,
          providerArgumentRetry: providerArgumentRetry ? 1 : 0,
          ...params.langfuseGenerationMetadata,
        },
      });
    };

    let res;
    try {
      res = await requestRound(false);
      const observeResponse = async (response: ChatCompletionResponse) => {
        if (!agentContext || !lastProjectionThroughEventId) return;
        const usage = response.usage;
        const finishReason = response.choices[0]?.finish_reason;
        const completionTokens = usage?.completion_tokens;
        const outputLimitReached = finishReason === "length" && completionTokens !== undefined &&
          roundCompletionMaxTokens !== undefined && completionTokens >= roundCompletionMaxTokens * 0.8;
        await agentContext.observe({
          throughEventId: lastProjectionThroughEventId,
          model,
          // Ambiguous/zero-output length responses take the stronger projection
          // path. Only measured completion saturation is classified as output truncation.
          outcome: finishReason === "length" ? outputLimitReached ? "output_length" : "context_overflow" : "completed",
          usage: usage ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
          } : undefined,
        });
      };
      await observeResponse(res);
      if (res.choices[0]?.finish_reason === "length") {
        const recoveryNudge: ChatMessage = {
          role: "system",
          content:
            "[Output recovery] The previous response was truncated. Make one small tool call only. " +
            "Do not repeat completed work or add explanatory prose; split large writes across later rounds.",
        };
        messages.push(recoveryNudge);
        emit?.(recoveryNudge);
        res = await requestRound(true);
        await observeResponse(res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const msgLower = msg.toLowerCase();
      const upstreamWrappedFailure =
        msgLower.includes("upstream_error") || msgLower.includes("bad_response_status_code");
      if (upstreamWrappedFailure) {
        throw new Error(
          `Transient provider upstream failure after gateway retries. Model: ${model}. ` +
            `Detail: ${msg.slice(0, 500)}`,
        );
      }
      if (msgLower.includes("insufficient completion budget")) {
        throw err;
      }
      if (msgLower.includes("invalid conversation history")) {
        throw err;
      }
      if (msgLower.includes("requests ending with a model turn")) {
        throw new Error(
          `Invalid conversation history for model "${model}": the provider rejected a request ` +
            `ending with an assistant/model turn. Append a user instruction or the matching ` +
            `tool result before retrying. Detail: ${msg.slice(0, 300)}`,
        );
      }
      const shouldDisableTools =
        activeTools.length > 0 &&
        (msg.includes("LLM HTTP 400") ||
          msgLower.includes("upstream_error") ||
          msgLower.includes("bad_response_status_code"));

      const explicitlyRejectsTools =
        /(?:tools?|function(?: declaration| calling)?|tool schema).{0,80}(?:not supported|unsupported|invalid)/i.test(msg) ||
        /(?:not supported|unsupported|invalid).{0,80}(?:tools?|function(?: declaration| calling)?|tool schema)/i.test(msg);

      const genericInvalidArgument =
        shouldDisableTools &&
        !explicitlyRejectsTools &&
        (msgLower.includes("invalid_argument") || msgLower.includes("invalid argument"));

      if (genericInvalidArgument) {
        if (resolveLlmProvider(model) === "gemini-compatible") {
          throw new Error(
            `Provider rejected the normalized Gemini-compatible payload. Model: ${model}. Detail: ${msg.slice(0, 500)}`,
          );
        }
        try {
          res = await requestRound(false, true);
          // Continue the normal response path with tools intact. This retry
          // strips only optional compatibility-layer request parameters.
        } catch (retryError) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          throw new Error(
            `Provider rejected request arguments after one minimal retry. ` +
              `Model: ${model}. Detail: ${retryMessage.slice(0, 500)}`,
          );
        }
      } else if (shouldDisableTools) {

        if (requireTools) {
          throw new Error(
            `Model "${model}" rejected the tool-calling payload (HTTP 400). ` +
              `This agent requires tool support — verify the model is compatible. ` +
              `Detail: ${msg.slice(0, 300)}`,
          );
        }
        console.warn(
          `[callLLMWithToolsFromMessages] model=${model} rejected tool payload; fallback to plain completion.`,
        );
        activeTools = [];
        continue;
      } else {
        throwClassifiedLLMError(err, model);
      }
    }

    const message = res.choices[0]?.message;
    if (!message) break;

    if (res.choices[0]?.finish_reason === "length") {
      const usage = res.usage;
      const reasoningTokens =
        usage?.completion_tokens_details?.reasoning_tokens;
      throw new Error(
        `LLM response truncated after one recovery attempt (finish_reason=length): ` +
          `phase=${phase} model=${model} iteration=${iteration} ` +
          `max_tokens=${roundCompletionMaxTokens ?? "provider-default"} ` +
          `prompt_tokens=${usage?.prompt_tokens ?? "unknown"} ` +
          `completion_tokens=${usage?.completion_tokens ?? "unknown"} ` +
          `reasoning_tokens=${reasoningTokens ?? "unknown"}.`,
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
        .filter((n): n is string => typeof n === "string" && n.length > 0) ??
      [];
    params.onAssistantRound?.({
      iteration,
      textPreview:
        typeof message.content === "string" && message.content.trim()
          ? message.content.trim().slice(0, 900)
          : null,
      toolCallNames,
    });

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (params.onAssistantStop?.({ iteration, message, messages })) {
        continue;
      }
      await syncContext();
      return {
        content: message.content?.trim() ?? lastAssistantContent,
        toolCalls,
      };
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
      maxSourceMutationCalls:
        params.completionProfile === "code" ? 1 : undefined,
    });
    await syncContext();

    if (shouldAbortAfterToolResults?.()) {
      return { content: lastAssistantContent, toolCalls };
    }
  }

  console.warn(
    `[callLLMWithToolsFromMessages] maxIterations (${maxIterations}) exhausted ` +
      `without a final assistant message. model=${model}, toolCalls=${toolCalls.length}`,
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
  "create_chrome_layout",
  "create_chrome_component",
  "read_chrome_file",
  "replace_chrome_file",
  "verify_chrome_files",
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
  >,
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
  message: {
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments?: string };
    }>;
  };
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
  maxSourceMutationCalls?: number;
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
    maxSourceMutationCalls,
  } = params;
  const calls = (message.tool_calls ?? []).map(parseToolCall);
  if (calls.length === 0) return;

  let sourceMutationCallCount = 0;
  const callsWithPolicy = calls.map((call) => {
    if (!SOURCE_MUTATION_TOOL_NAMES.has(call.name)) {
      return { call, skippedResult: undefined };
    }
    sourceMutationCallCount += 1;
    if (
      maxSourceMutationCalls == null ||
      sourceMutationCallCount <= maxSourceMutationCalls
    ) {
      return { call, skippedResult: undefined };
    }
    const skippedResult: ToolResult = {
      success: false,
      error:
        "Skipped: only one source mutation tool call is allowed per model response.",
    };
    return { call, skippedResult };
  });

  const serializeForModel = (
    call: ParsedToolCall,
    result: ToolResult | string,
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
    for (const { call, skippedResult } of callsWithPolicy) {
      const result =
        skippedResult ?? (await executeOne(call, executeToolOverrides));
      toolCalls.push({ name: call.name, args: call.args, result });
      if (!skippedResult) {
        onToolCall?.({ name: call.name, args: call.args, result, iteration });
      }
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
    callsWithPolicy.map(async ({ call, skippedResult }) => {
      if (skippedResult) return { call, result: skippedResult, skipped: true };
      try {
        const result = await executeOne(call, executeToolOverrides);
        return { call, result, skipped: false };
      } catch (err) {
        const errorResult: ToolResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
        return { call, result: errorResult, skipped: false };
      }
    }),
  );

  for (const { call, result, skipped } of settled) {
    toolCalls.push({ name: call.name, args: call.args, result });
    if (!skipped) {
      onToolCall?.({ name: call.name, args: call.args, result, iteration });
    }
    const toolMsg: ChatMessage = {
      role: "tool",
      tool_call_id: call.id,
      content: serializeForModel(call, result),
    };
    messages.push(toolMsg);
    emit?.(toolMsg);
  }
}
