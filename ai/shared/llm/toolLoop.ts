import { getModelId } from "@/lib/config/models";
import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import { chatCompletion } from "./gateway";
import type { AgentToolCallRecord, ChatMessage } from "./types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export async function callLLMWithTools(params: {
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];
  temperature?: number;
  maxIterations?: number;
  model?: string;
  thinkingLevel?: string;
  executeToolOverrides?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>>;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const {
    systemPrompt,
    userMessage,
    tools,
    temperature = 0.1,
    maxIterations = 8,
    executeToolOverrides = {},
  } = params;
  const model = params.model || getModelId();
  let activeTools = tools;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const toolCalls: AgentToolCallRecord[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let res;
    try {
      res = await chatCompletion({
        model,
        messages,
        temperature,
        tools: activeTools.length > 0 ? activeTools : undefined,
        tool_choice: activeTools.length > 0 ? "auto" : undefined,
        ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
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
      throw err;
    }

    const message = res.choices[0]?.message;
    if (!message) break;

    if (res.choices[0]?.finish_reason === "length") {
      throw new Error(
        `LLM response truncated (finish_reason=length) at iteration ${iteration}. Reduce prompt size or increase max_tokens.`
      );
    }

    messages.push(message as unknown as ChatMessage);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { content: message.content?.trim() ?? "", toolCalls };
    }

    for (const toolCall of message.tool_calls) {
      const rawArgs = toolCall.function.arguments ?? "{}";
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      const overrideFn = executeToolOverrides[toolCall.function.name];
      const result = overrideFn
        ? await overrideFn(parsedArgs)
        : await executeSystemTool(toolCall.function.name, parsedArgs);

      toolCalls.push({ name: toolCall.function.name, args: parsedArgs, result });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
  }

  console.warn(
    `[callLLMWithTools] maxIterations (${maxIterations}) exhausted without a final response. Returning last tool call results.`
  );
  return { content: "", toolCalls };
}
