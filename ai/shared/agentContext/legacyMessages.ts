import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ContextEvent, NewContextEvent, ToolCallEvent } from "./types";
import { inferToolSemantics } from "./toolSemantics";

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function parseCalls(message: ChatMessage): ToolCallEvent[] {
  if (!Array.isArray(message.tool_calls)) return [];
  return message.tool_calls.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("INVALID_PROTOCOL_HISTORY: malformed tool call");
    }
    const call = raw as Record<string, unknown>;
    const fn = call.function;
    if (typeof call.id !== "string" || !fn || typeof fn !== "object") {
      throw new Error("INVALID_PROTOCOL_HISTORY: malformed tool call");
    }
    const record = fn as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.arguments !== "string") {
      throw new Error(`INVALID_PROTOCOL_HISTORY: malformed tool call ${call.id}`);
    }
    return { id: call.id, name: record.name, argumentsJson: record.arguments };
  });
}

/** Converts an append-only legacy transcript into provider-neutral canonical events. */
export function legacyMessagesToEvents(
  messages: readonly ChatMessage[],
  startIndex = 0,
): NewContextEvent[] {
  const calls = new Map<string, ToolCallEvent>();
  // Incremental conversion still needs call metadata from the prefix.
  for (const message of messages.slice(0, startIndex)) {
    if (message.role !== "assistant") continue;
    for (const call of parseCalls(message)) calls.set(call.id, call);
  }

  return messages.slice(startIndex).map((message): NewContextEvent => {
    if (message.role === "system") {
      const recovery = typeof message.content === "string" && message.content.startsWith("[Output recovery]");
      return { kind: "instruction", scope: recovery ? "recovery" : "system", content: message.content };
    }
    if (message.role === "user") return { kind: "user_message", content: message.content };
    if (message.role === "assistant") {
      const toolCalls = parseCalls(message);
      if (toolCalls.length === 0) return { kind: "assistant_message", content: message.content };
      for (const call of toolCalls) {
        if (calls.has(call.id)) {
          throw new Error(`INVALID_PROTOCOL_HISTORY: duplicate tool call id ${call.id}`);
        }
        calls.set(call.id, call);
      }
      return { kind: "assistant_tool_calls", content: message.content, calls: toolCalls };
    }
    if (typeof message.tool_call_id !== "string") {
      throw new Error("INVALID_PROTOCOL_HISTORY: tool result has no call id");
    }
    const call = calls.get(message.tool_call_id);
    if (!call) {
      throw new Error(`INVALID_PROTOCOL_HISTORY: orphan tool result ${message.tool_call_id}`);
    }
    const result = typeof message.content === "string" ? parseJson(message.content) as never : JSON.stringify(message.content);
    const args = parseJson(call.argumentsJson);
    return {
      kind: "tool_result",
      callId: call.id,
      toolName: call.name,
      arguments: args,
      result,
      semantics: inferToolSemantics(call.name, args, result),
    };
  });
}

/** Lossless provider-shaped transcript for compatibility UIs and V1 readers. */
export function contextEventsToLegacyMessages(events: readonly ContextEvent[]): ChatMessage[] {
  return events.flatMap((event): ChatMessage[] => {
    if (event.kind === "instruction") {
      return [{ role: event.scope === "task" ? "user" : "system", content: event.content }];
    }
    if (event.kind === "user_message") return [{ role: "user", content: event.content }];
    if (event.kind === "assistant_message") return [{ role: "assistant", content: event.content }];
    if (event.kind === "assistant_tool_calls") {
      return [{
        role: "assistant",
        content: event.content,
        tool_calls: event.calls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.argumentsJson },
        })),
      }];
    }
    if (event.kind === "tool_result") {
      return [{
        role: "tool",
        tool_call_id: event.callId,
        content: typeof event.result === "string" ? event.result : JSON.stringify(event.result),
      }];
    }
    return [];
  });
}
