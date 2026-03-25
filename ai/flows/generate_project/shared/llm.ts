import OpenAI from "openai";
import { getModelId } from "../../../../lib/config/models";
import { executeSystemTool } from "../../../tools";
import type { ToolResult } from "../../../tools";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import ts from "typescript";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  maxTokens?: number
): Promise<string> {
  const model = getModelId();
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature,
    ...(maxTokens != null && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
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
      ...(message as unknown as Record<string, unknown>),
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
  const trimmed = raw.trim();
  const escapedLang = lang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const preferredFenceRe = new RegExp(
    `\\\`\\\`\\\`(?:${escapedLang})?\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\``,
    "i"
  );
  const genericFenceRe = /```(?:[a-z0-9_-]+)?\s*\n([\s\S]*?)\n```/i;
  const fencedMatch =
    (lang ? trimmed.match(preferredFenceRe) : null) ?? trimmed.match(genericFenceRe);
  const extracted = fencedMatch ? fencedMatch[1].trim() : trimmed;

  if (lang.toLowerCase() === "tsx") {
    return sanitizeTsxContent(extracted);
  }

  return extracted;
}

function sanitizeTsxContent(raw: string): string {
  const withoutFenceLines = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();

  if (!withoutFenceLines) {
    return withoutFenceLines;
  }

  const lines = withoutFenceLines.split("\n");
  for (let end = lines.length; end > 0; end -= 1) {
    const candidate = lines.slice(0, end).join("\n").trimEnd();
    if (!looksLikeTsxModule(candidate)) {
      continue;
    }

    const transpileResult = ts.transpileModule(candidate, {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "generated.tsx",
      reportDiagnostics: true,
    });

    if ((transpileResult.diagnostics?.length ?? 0) === 0) {
      return candidate;
    }
  }

  return withoutFenceLines;
}

function looksLikeTsxModule(content: string): boolean {
  return /(?:^|\n)(?:"use client";|import |export default |export const |function )/m.test(content);
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
