import OpenAI from "openai";
import { getModelId } from "../../../../lib/config/models";
import { executeSystemTool } from "../../../tools";
import type { ToolResult } from "../../../tools";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7
): Promise<string> {
  const model = getModelId();
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}

export interface AgentToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult | string;
}

export async function callLLMWithTools(params: {
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];
  temperature?: number;
  maxIterations?: number;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const { systemPrompt, userMessage, tools, temperature = 0.1, maxIterations = 8 } = params;
  const model = getModelId();
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const toolCalls: AgentToolCallRecord[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const res = await openai.chat.completions.create({
      model,
      messages: messages as never,
      tools,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      temperature,
    });
    const message = res.choices[0]?.message;
    if (!message) {
      break;
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls ?? undefined,
    });

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message.content?.trim() ?? "",
        toolCalls,
      };
    }

    for (const toolCall of message.tool_calls) {
      const rawArgs = toolCall.function.arguments ?? "{}";
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      const result = await executeSystemTool(toolCall.function.name, parsedArgs);
      toolCalls.push({
        name: toolCall.function.name,
        args: parsedArgs,
        result,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
  }

  return {
    content: "",
    toolCalls,
  };
}

export function extractContent(raw: string, lang = ""): string {
  const fenceRe = new RegExp(
    `^\\\`\\\`\\\`(?:${lang})?\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\`\\s*$`,
    "i"
  );
  const match = raw.trim().match(fenceRe);
  return match ? match[1].trim() : raw.trim();
}

export function extractJSON(raw: string): string {
  const stripped = extractContent(raw, "json");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1) {
    return stripped;
  }

  return stripped.slice(start, end + 1);
}
