import { getModelId } from "../../../../lib/config/models";
import { executeSystemTool } from "../../../tools";
import type { ToolResult } from "../../../tools";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import ts from "typescript";

// ── Native fetch LLM client ───────────────────────────────────────────────────
// We intentionally avoid the OpenAI SDK's HTTP layer because it uses
// agentkeepalive with a default socket timeout of 8s, which kills long LLM
// responses. Native fetch (undici in Node 18+) has no such limit.

function getApiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Check .env.local");
  return { apiKey, baseURL };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function chatCompletion(params: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ChatCompletionTool[];
  tool_choice?: string;
}): Promise<ChatCompletionResponse> {
  const { apiKey, baseURL } = getApiConfig();

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      ...(params.max_tokens ? { max_tokens: params.max_tokens } : {}),
      ...(params.tools ? { tools: params.tools, tool_choice: params.tool_choice ?? "auto" } : {}),
    }),
    signal: AbortSignal.timeout(100_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<ChatCompletionResponse>;
}

export interface LLMCallResult {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  maxTokens?: number
): Promise<string> {
  return (await callLLMWithMeta(systemPrompt, userMessage, temperature, maxTokens)).content;
}

export async function callLLMWithMeta(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.7,
  maxTokens?: number
): Promise<LLMCallResult> {
  const model = getModelId();
  try {
    const res = await chatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      ...(maxTokens != null && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
    });

    const content = res.choices[0]?.message?.content?.trim() ?? "";
    if (!content && res.choices[0]?.finish_reason === "length") {
      throw new Error(`LLM response truncated (max_tokens reached). Model: ${model}`);
    }

    return {
      content,
      model,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
  } catch (err: unknown) {
    // Dig into the full error chain — OpenAI SDK wraps the real error in .cause
    const errObj = err as { status?: number; code?: string; message?: string; type?: string; cause?: { code?: string; message?: string; cause?: { code?: string; message?: string } }; error?: { message?: string; type?: string; code?: string } };
    const status = errObj.status;
    const code = errObj.code ?? errObj.error?.code ?? errObj.cause?.code;
    const type = errObj.type ?? errObj.error?.type;
    const msg = errObj.error?.message ?? errObj.message ?? String(err);

    // Walk the cause chain for the real error
    const causes: string[] = [];
    let cursor: { message?: string; code?: string; cause?: unknown } | undefined = errObj.cause as typeof errObj.cause;
    for (let depth = 0; cursor && depth < 5; depth++) {
      causes.push(`[cause${depth}] ${cursor.code ?? ""} ${cursor.message ?? ""}`);
      cursor = cursor.cause as typeof cursor;
    }
    const causeChain = causes.length > 0 ? ` | causes: ${causes.join(" → ")}` : "";

    // Log full error to server console for debugging
    console.error(`[LLM ERROR] model=${model} status=${status} code=${code} msg=${msg}${causeChain}`);

    const detail = [
      `Model: ${model}`,
      status ? `HTTP ${status}` : null,
      code ? `code: ${code}` : null,
      type ? `type: ${type}` : null,
      `message: ${msg}`,
      causeChain || null,
    ].filter(Boolean).join(" | ");

    // Classify the error for the caller
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
      throw new Error(`LLM connection failed — API endpoint unreachable. ${detail}`);
    }
    if (status === 401 || status === 403) {
      throw new Error(`LLM auth error — check OPENAI_API_KEY. ${detail}`);
    }
    if (status === 429) {
      throw new Error(`LLM rate limited — too many requests. ${detail}`);
    }
    if (status === 500 || status === 502 || status === 503) {
      throw new Error(`LLM server error — API provider issue. ${detail}`);
    }
    if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("TIMEOUT")) {
      throw new Error(`LLM request timed out (>100s). Prompt may be too large or API too slow. ${detail}`);
    }

    throw new Error(`LLM call failed. ${detail}`);
  }
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
  executeToolOverrides?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult | string>>;
}): Promise<{ content: string; toolCalls: AgentToolCallRecord[] }> {
  const { systemPrompt, userMessage, tools, temperature = 0.1, maxIterations = 8, executeToolOverrides = {} } = params;
  const model = getModelId();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const toolCalls: AgentToolCallRecord[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const res = await chatCompletion({
      model,
      messages,
      temperature,
      tools,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });
    const message = res.choices[0]?.message;
    if (!message) break;

    // Truncated response means the model ran out of tokens mid-generation
    if (res.choices[0]?.finish_reason === "length") {
      throw new Error(`LLM response truncated (finish_reason=length) at iteration ${iteration}. Reduce prompt size or increase max_tokens.`);
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls,
    });

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

      // Use override executor if provided, otherwise fall back to system tools
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

  // maxIterations exhausted without a final non-tool response — surface this
  // clearly instead of silently returning empty string (s01 principle: loops
  // must have a visible exit condition).
  console.warn(`[callLLMWithTools] maxIterations (${maxIterations}) exhausted without a final response. Returning last tool call results.`);
  return { content: "", toolCalls };
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

  // If the LLM repeated itself, extract only the first complete module.
  // A new module starts with "use client", an import, or an export at column 0
  // after the first module has already begun.
  const deduped = extractFirstModule(withoutFenceLines);

  const lines = deduped.split("\n");
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

  return deduped;
}

/**
 * When the LLM outputs the same component twice (or appends extra content after
 * the closing of the first module), strip everything after the first complete
 * export default / named export block ends.
 *
 * Strategy: find the second occurrence of a module-level declaration boundary
 * (a line that starts a new "use client" / import block at column 0 after we've
 * already seen at least one export). Everything from that line onward is noise.
 */
function extractFirstModule(content: string): string {
  const lines = content.split("\n");
  let seenExport = false;
  let moduleEndLine = lines.length;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^export\s+(default|function|const|class)\b/.test(line)) {
      seenExport = true;
      continue;
    }

    // After we've seen an export, a new top-level "use client" or import
    // signals the start of a second module.
    if (seenExport && /^(?:"use client"|'use client'|import\s)/.test(line)) {
      moduleEndLine = i;
      break;
    }
  }

  return lines.slice(0, moduleEndLine).join("\n").trimEnd();
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
