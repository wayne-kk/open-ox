import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";

/**
 * Think tool — internal scratchpad for the agent.
 *
 * Inspired by Claude Code's extended thinking: gives the LLM a structured
 * place to reason without side effects. The content is returned as-is,
 * allowing the LLM to "think out loud" in a tool call format that counts
 * toward its reasoning budget but doesn't modify any files.
 *
 * Use cases:
 * - Planning before a complex multi-file edit
 * - Analyzing a build error before deciding what to fix
 * - Breaking down a vague user instruction into concrete steps
 */
export const thinkTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "think",
    description:
      "Use this tool to think through a problem step by step. No side effects — just structured reasoning. " +
      "Call this BEFORE complex edits to plan your approach, or AFTER a build failure to analyze the root cause. " +
      "Your thinking will be visible to the user as part of the agent trace.",
    parameters: {
      type: "object",
      properties: {
        analysis: {
          type: "string",
          description: "Your step-by-step analysis, plan, or reasoning.",
        },
      },
      required: ["analysis"],
    },
  },
};

export const executeThink: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const analysis = args.analysis as string;
  if (!analysis) return { success: false, error: "Missing analysis" };
  // No side effects — just echo back the thinking
  return { success: true, output: analysis };
};
