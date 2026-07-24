import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult } from "@/ai/tools";
import type { ChatMessage, ChatMessageContent } from "@/ai/shared/llm/types";

export type ContextSessionKind =
  | "page"
  | "scaffold"
  | "chrome"
  | "intent"
  | "modify"
  | "subagent";

export interface AgentContextSpec {
  sessionId: string;
  sessionKind: ContextSessionKind;
  policyVersion: "v1";
}

export interface ToolCallEvent {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface ToolSemantics {
  outcome: "success" | "failure";
  effect: "observe" | "mutate" | "verify" | "transition" | "opaque";
  reproducible: boolean;
  resource?: { kind: string; key: string; revision?: string };
  diagnostics?: { state: "none" | "unresolved" | "resolved" };
}

export type NewContextEvent =
  | { kind: "instruction"; scope: "system" | "task" | "recovery"; content: ChatMessageContent }
  | { kind: "user_message"; content: ChatMessageContent }
  | { kind: "assistant_message"; content: ChatMessageContent }
  | { kind: "assistant_tool_calls"; content: ChatMessageContent; calls: readonly ToolCallEvent[] }
  | {
      kind: "tool_result";
      callId: string;
      toolName: string;
      arguments: unknown;
      result: ToolResult | string;
      semantics?: ToolSemantics;
    }
  | { kind: "task_state"; state: DurableTaskState }
  | { kind: "condensation"; condensation: Condensation };

export interface ContextEventBase {
  id: string;
  sessionId: string;
  sequence: number;
  createdAt: string;
}

export type ContextEvent = NewContextEvent & ContextEventBase;

export interface DurableTaskState {
  goal?: string;
  targetPaths?: readonly string[];
  mutations?: readonly { path: string; operation: string; revision?: string; outcome: "success" | "failure" }[];
  unresolvedDiagnostics?: readonly { path?: string; summary: string; fingerprint?: string }[];
  verification?: readonly { check: string; outcome: "passed" | "failed" | "not_run" }[];
  decisions?: readonly string[];
}

export interface Condensation {
  coveredSequence: { from: number; through: number };
  forgottenEventIds: readonly string[];
  summary: string;
  policyVersion: string;
}

export interface AppendReceipt {
  eventIds: readonly string[];
  throughEventId: string;
}

export interface ProjectionRequest {
  model: { id: string; provider: "openai" | "anthropic" | "gemini-compatible"; contextWindow: number };
  tools: readonly ChatCompletionTool[];
  toolChoice: "auto" | "required" | "none";
  completionProfile: "control" | "code";
  pressure: "normal" | "overflow_recovery";
}

export type CompactionStage =
  | "externalize_payloads"
  | "mutation_receipts"
  | "superseded_observations"
  | "resolved_diagnostics"
  | "truncate_reproducible_output"
  | "typed_checkpoint"
  | "semantic_condensation";

export interface ContextProjection {
  messages: readonly ChatMessage[];
  maxCompletionTokens: number;
  throughEventId: string;
  provenance: {
    includedEventIds: readonly string[];
    summarizedEventIds: readonly string[];
    omittedEventIds: readonly string[];
    condensationEventIds: readonly string[];
  };
  budget: {
    contextWindow: number;
    estimatedInputTokens: number;
    toolSchemaTokens: number;
    completionReserve: number;
    safetyReserve: number;
  };
  compaction: {
    stages: readonly CompactionStage[];
    estimatedTokensBefore: number;
    estimatedTokensAfter: number;
    removedPayloadBytes: number;
  };
}

export interface ProviderObservation {
  throughEventId: string;
  model: string;
  outcome: "completed" | "output_length" | "context_overflow" | "provider_error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

export interface ContextEventStore {
  append(sessionId: string, events: readonly NewContextEvent[]): Promise<readonly ContextEvent[]>;
  read(sessionId: string, afterSequence?: number): Promise<readonly ContextEvent[]>;
}

export interface AgentContext {
  append(events: readonly NewContextEvent[]): Promise<AppendReceipt>;
  project(request: ProjectionRequest): Promise<ContextProjection>;
  observe(observation: ProviderObservation): Promise<void>;
}

export interface AgentContextDependencies {
  eventStore: ContextEventStore;
}
