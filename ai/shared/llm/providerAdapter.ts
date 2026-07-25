import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ChatCompletionParams, ChatMessage, LlmProvider } from "./types";

export interface ProviderPayload {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ChatCompletionTool[];
  tool_choice?: string;
  parallel_tool_calls?: boolean;
  thinking_level?: string;
}

export function resolveLlmProvider(model: string): LlmProvider {
  const id = model.toLowerCase();
  if (id.includes("gemini")) return "gemini-compatible";
  if (id.includes("claude") || id.includes("anthropic")) return "anthropic";
  return "openai";
}

function jsonString(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? null);
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
    return {
      ...message,
      content: message.content === "" ? null : message.content,
      tool_calls: message.tool_calls.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const call = raw as Record<string, unknown>;
        const fn = call.function;
        if (!fn || typeof fn !== "object") return raw;
        const functionRecord = fn as Record<string, unknown>;
        return {
          ...call,
          function: {
            ...functionRecord,
            arguments: jsonString(functionRecord.arguments ?? {}),
          },
        };
      }),
    };
  }
  if (message.role === "tool") return { ...message, content: jsonString(message.content) };
  return { ...message };
}

function geminiMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  let conversationStarted = false;
  return messages.map(normalizeMessage).map((message) => {
    if (message.role !== "system") {
      conversationStarted = true;
      return message;
    }
    if (!conversationStarted) return message;
    return {
      ...message,
      role: "user" as const,
      content: typeof message.content === "string"
        ? `[Instruction continuation]\n${message.content}`
        : message.content,
    };
  });
}

function normalizeSchema(value: unknown, propertyName?: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => normalizeSchema(entry));
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === "strict" || key === "$schema") continue;
    if (key === "properties" && entry && typeof entry === "object" && !Array.isArray(entry)) {
      result[key] = Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).map(([name, schema]) => [name, normalizeSchema(schema, name)]),
      );
      continue;
    }
    if (key === "type" && entry === "number" && (propertyName === "line" || propertyName === "character")) {
      result[key] = "integer";
      continue;
    }
    result[key] = normalizeSchema(entry, propertyName);
  }
  return result;
}

function geminiTools(tools: readonly ChatCompletionTool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    ...tool,
    function: {
      ...tool.function,
      parameters: normalizeSchema(tool.function.parameters) as ChatCompletionTool["function"]["parameters"],
    },
  }));
}

export function buildProviderPayload(params: ChatCompletionParams): ProviderPayload {
  const provider = params.provider ?? resolveLlmProvider(params.model);
  const gemini = provider === "gemini-compatible";
  return {
    model: params.model,
    messages: gemini ? geminiMessages(params.messages) : params.messages.map(normalizeMessage),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.max_tokens !== undefined ? { max_tokens: params.max_tokens } : {}),
    ...(params.tools?.length ? { tools: gemini ? geminiTools(params.tools) : [...params.tools] } : {}),
    ...(!gemini && params.tool_choice !== undefined ? { tool_choice: params.tool_choice } : {}),
    ...(!gemini && params.parallel_tool_calls !== undefined ? { parallel_tool_calls: params.parallel_tool_calls } : {}),
    ...(!gemini && params.thinking_level !== undefined ? { thinking_level: params.thinking_level } : {}),
  };
}

export function validateProviderPayload(payload: ProviderPayload, provider: LlmProvider): void {
  const last = payload.messages.at(-1);
  if (provider === "gemini-compatible" && payload.messages.slice(1).some((message) => message.role === "system")) {
    throw new Error("PROVIDER_PROTOCOL_INVALID: Gemini-compatible history contains a late system message");
  }
  if (provider === "gemini-compatible" && last?.role === "assistant") {
    throw new Error("PROVIDER_PROTOCOL_INVALID: request ends with an assistant/model turn");
  }
  for (const message of payload.messages) {
    if (message.role === "tool" && typeof message.content !== "string") {
      throw new Error("PROVIDER_PROTOCOL_INVALID: tool content must be a string");
    }
    if (message.role !== "assistant" || !Array.isArray(message.tool_calls)) continue;
    for (const raw of message.tool_calls) {
      const fn = raw && typeof raw === "object" ? (raw as Record<string, unknown>).function : undefined;
      if (!fn || typeof fn !== "object" || typeof (fn as Record<string, unknown>).arguments !== "string") {
        throw new Error("PROVIDER_PROTOCOL_INVALID: tool arguments must be a JSON string");
      }
    }
  }
}
