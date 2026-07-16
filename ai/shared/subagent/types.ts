import type { ToolResult } from "@/ai/tools/types";

export const SUBAGENT_KINDS = ["explore", "verifier"] as const;
export type SubagentKind = (typeof SUBAGENT_KINDS)[number];

export function isSubagentKind(value: string): value is SubagentKind {
  return (SUBAGENT_KINDS as readonly string[]).includes(value);
}

export type SubagentSpec = {
  kind: SubagentKind;
  /** Routing signal for parent models / spawn tool descriptions. */
  description: string;
  systemPrompt: string;
  /** Whitelist from systemToolCatalog (plus host overrides). */
  toolNames: string[];
  readonly: true;
  maxIterations: number;
  /** When set, pins the child model; otherwise inherit host / default. */
  model?: string;
  maxSummaryChars: number;
};

export type SubagentRunInput = {
  kind: SubagentKind;
  /** Task brief for the child; must be self-contained (no parent history). */
  task: string;
  focusPaths?: string[];
  /** Extra context (build logs, claim text, etc.). */
  extraContext?: string;
  model?: string;
  executeToolOverrides?: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult | string>
  >;
  onToolCall?: (info: {
    name: string;
    args: Record<string, unknown>;
    iteration: number;
    result: ToolResult | string;
  }) => void;
};

export type SubagentResult = {
  kind: SubagentKind;
  ok: boolean;
  summary: string;
  toolCallCount: number;
  truncated: boolean;
  error?: string;
};

export type SubagentHostContext = {
  /** Kinds the host may spawn (e.g. Modify only allows explore). */
  allowedKinds: SubagentKind[];
  model?: string;
  onEvent?: (event: {
    type: "thinking" | "tool_call";
    content?: string;
    tool?: string;
    args?: Record<string, unknown>;
    result?: string;
    subagentKind?: SubagentKind;
  }) => void;
};

/** Tool name injected by hosts; not part of systemToolCatalog. */
export const SPAWN_SUBAGENT_TOOL_NAME = "spawn_subagent" as const;
