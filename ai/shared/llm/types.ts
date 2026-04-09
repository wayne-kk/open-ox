import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";

export type ChatMessageContent =
  | string
  | null
  | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  >;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: ChatMessageContent;
  tool_calls?: unknown[];
  tool_call_id?: string;
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
      [key: string]: unknown;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ChatCompletionTool[];
  tool_choice?: string;
  parallel_tool_calls?: boolean;
  /** Forwarded to upstream chat/completions when set (e.g. Gemini-compatible gateways). */
  thinking_level?: string;
}

export interface AgentToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult | string;
}
