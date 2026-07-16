import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { callLLMWithTools } from "@/ai/shared/llm/toolLoop";
import { assertCanSpawnSubagent, withSubagentDepth } from "./nesting";
import { getSubagentSpec } from "./registry";
import type { SubagentResult, SubagentRunInput } from "./types";

function buildUserMessage(input: SubagentRunInput): string {
  const parts = [`## Task\n${input.task.trim()}`];
  if (input.focusPaths?.length) {
    parts.push(
      `## Focus paths\n${input.focusPaths.map((p) => `- ${p}`).join("\n")}`
    );
  }
  if (input.extraContext?.trim()) {
    parts.push(`## Extra context\n${input.extraContext.trim()}`);
  }
  parts.push(
    "When done, reply with the final summary only (no further tool calls)."
  );
  return parts.join("\n\n");
}

function truncateSummary(
  text: string,
  maxChars: number
): { summary: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return { summary: trimmed, truncated: false };
  }
  return {
    summary: `${trimmed.slice(0, maxChars - 20)}\n…[truncated]`,
    truncated: true,
  };
}

/**
 * Run a registered subagent in an isolated tool-loop context.
 * Intermediate tool output stays inside the child loop; callers only receive the summary.
 */
export async function runSubagent(input: SubagentRunInput): Promise<SubagentResult> {
  const task = input.task?.trim() ?? "";
  if (!task) {
    return {
      kind: input.kind,
      ok: false,
      summary: "",
      toolCallCount: 0,
      truncated: false,
      error: "Subagent task must be a non-empty string.",
    };
  }

  try {
    assertCanSpawnSubagent();
  } catch (err) {
    return {
      kind: input.kind,
      ok: false,
      summary: "",
      toolCallCount: 0,
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const spec = getSubagentSpec(input.kind);
  const tools = getSystemToolDefinitions(spec.toolNames);

  return withSubagentDepth(async () => {
    try {
      const { content, toolCalls } = await callLLMWithTools({
        systemPrompt: spec.systemPrompt,
        userMessage: buildUserMessage(input),
        tools,
        temperature: 0.1,
        maxIterations: spec.maxIterations,
        model: input.model ?? spec.model,
        executeToolOverrides: input.executeToolOverrides,
        onToolCall: input.onToolCall,
        langfusePhase: `subagent_${spec.kind}`,
        langfuseGenerationMetadata: {
          subagentKind: spec.kind,
          focusPathCount: input.focusPaths?.length ?? 0,
        },
      });

      const { summary, truncated } = truncateSummary(
        content ||
          "(subagent finished without a text summary; inspect toolCallCount)",
        spec.maxSummaryChars
      );

      return {
        kind: spec.kind,
        ok: true,
        summary,
        toolCallCount: toolCalls.length,
        truncated,
      };
    } catch (err) {
      return {
        kind: spec.kind,
        ok: false,
        summary: "",
        toolCallCount: 0,
        truncated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
