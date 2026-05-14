import type { AgentToolCallRecord } from "@/ai/shared/llm/types";
import type { ToolResult } from "@/ai/tools/types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export type IntentAgentYieldKind = "capability" | "clarify" | "options" | "confirm_brief";

export interface IntentAgentOption {
  id: string;
  label: string;
  hint?: string;
}

export interface IntentAgentYieldPayload {
  kind: IntentAgentYieldKind;
  message: string;
  suggestedReplies: string[];
  options: IntentAgentOption[];
  briefDraftMarkdown?: string;
}

export type IntentAgentTurnStatus = "yield" | "commit_generate" | "implicit_yield" | "error";

export interface IntentAgentTurnResult {
  status: IntentAgentTurnStatus;
  yieldPayload?: IntentAgentYieldPayload;
  mergedBrief?: string;
  errorMessage?: string;
  turnCounter: number;
  toolCalls: AgentToolCallRecord[];
  assistantText?: string;
}

/** Custom executor for merged tools — cannot override yield_to_user / commit_generate. */
export type IntentAgentToolHandler = (
  args: Record<string, unknown>
) => Promise<ToolResult | string>;

/**
 * Programmatic tool surface extension. Unlisted tool names still delegate to
 * `executeSystemTool` when registered globally (e.g. `web_search` via route overrides elsewhere).
 */
export interface IntentAgentToolExtensions {
  tools?: ChatCompletionTool[];
  toolHandlers?: Record<string, IntentAgentToolHandler>;
}

/** Streaming progress for UI during intent analysis (tools, model rounds, optional reasoning text). */
export type IntentProgressEvent =
  | {
      kind: "assistant_round";
      iteration: number;
      textPreview: string | null;
      toolCallNames: string[];
    }
  | { kind: "reasoning"; iteration: number; text: string }
  | {
      kind: "tool";
      iteration: number;
      toolName: string;
      argsPreview: string;
      resultPreview: string;
    };
