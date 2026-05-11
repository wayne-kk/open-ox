import type { ChatCompletionParams, ChatCompletionResponse } from "./types";
import { getLangfuseGenerationParent } from "@/lib/observability/langfuseTracing";
import { OXGEN_PREFIX } from "@/lib/observability/langfuseGenerationCatalog";
import { Agent, request } from "undici";

const MIN_CONNECT_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 300_000;

function parseTimeout(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const configuredConnectTimeoutMs = parseTimeout(process.env.LLM_CONNECT_TIMEOUT_MS, MIN_CONNECT_TIMEOUT_MS);
const connectTimeoutMs = Math.max(MIN_CONNECT_TIMEOUT_MS, configuredConnectTimeoutMs);
const llmDispatcher = new Agent({
  connect: { timeout: connectTimeoutMs },
});

/** Langfuse-serializable snapshot of chat messages (full content, no redaction). */
function messagesForObservation(messages: ChatCompletionParams["messages"]): unknown[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_calls !== undefined ? { tool_calls: m.tool_calls } : {}),
    ...(m.tool_call_id !== undefined ? { tool_call_id: m.tool_call_id } : {}),
  }));
}

function getApiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Check .env.local");
  return { apiKey, baseURL };
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
  const { apiKey, baseURL } = getApiConfig();
  const maxRetries = 2;

  const modelParameters: Record<string, string | number> = {};
  if (params.temperature !== undefined) modelParameters.temperature = params.temperature;
  if (params.max_tokens !== undefined) modelParameters.max_tokens = params.max_tokens;
  if (params.thinking_level !== undefined)
    modelParameters.thinking_level = params.thinking_level;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const baseName = params.langfuseGenerationName ?? `${OXGEN_PREFIX}.completion`;
    const generationName = attempt === 0 ? baseName : `${baseName}.http_retry_${attempt}`;
    const lfParent = getLangfuseGenerationParent();
    const lfGen =
      lfParent !== null
        ? lfParent.generation({
            name: generationName,
            model: params.model,
            input: messagesForObservation(params.messages),
            metadata: {
              attempt,
              hasTools: Boolean(params.tools?.length),
              ...params.langfuseGenerationMetadata,
            },
            modelParameters:
              Object.keys(modelParameters).length > 0 ? modelParameters : undefined,
          })
        : null;

    const payload = JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      ...(params.max_tokens ? { max_tokens: params.max_tokens } : {}),
      ...(params.thinking_level ? { thinking_level: params.thinking_level } : {}),
      ...(params.tools
        ? {
          tools: params.tools,
          tool_choice: params.tool_choice ?? "auto",
          ...(params.parallel_tool_calls !== undefined
            ? { parallel_tool_calls: params.parallel_tool_calls }
            : {}),
        }
        : {}),
    });

    let statusCode: number;
    let bodyText: string;
    try {
      const response = await request(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        dispatcher: llmDispatcher,
      });
      statusCode = response.statusCode;
      bodyText = await response.body.text();
    } catch (error) {
      lfGen?.end({
        metadata: {
          networkError: true,
          stage: "request",
          attempt,
        },
        statusMessage:
          error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        output: undefined,
      });
      if (attempt < maxRetries) {
        const delay = 1000 * (attempt + 1);
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[chatCompletion] network error "${message}", retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }

    if (statusCode < 200 || statusCode >= 300) {
      const bodyLower = bodyText.toLowerCase();
      const isUpstreamWrapped400 =
        statusCode === 400 &&
        (bodyLower.includes("upstream_error") || bodyLower.includes("bad_response_status_code"));
      const isRetryable =
        statusCode === 500 || statusCode === 502 || statusCode === 503 || isUpstreamWrapped400;

      lfGen?.end({
        metadata: { httpStatus: statusCode, retryable: isRetryable, attempt },
        statusMessage: `HTTP ${statusCode}`,
        output: { bodyPreview: bodyText.slice(0, 4000) },
      });

      if (isRetryable && attempt < maxRetries) {
        const delay = 1000 * (attempt + 1);
        console.warn(
          `[chatCompletion] HTTP ${statusCode}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error(`[chatCompletion] HTTP ${statusCode} body=${bodyText}`);
      throw new Error(`LLM HTTP ${statusCode}: ${bodyText}`);
    }

    let parsed: ChatCompletionResponse;
    try {
      parsed = JSON.parse(bodyText) as ChatCompletionResponse;
    } catch (parseErr) {
      lfGen?.end({
        metadata: { parseError: true, attempt },
        statusMessage: parseErr instanceof Error ? parseErr.message : String(parseErr),
        output: { rawPreview: bodyText.slice(0, 2000) },
      });
      throw parseErr;
    }

    const choice = parsed.choices[0]?.message;
    const lfUsage =
      parsed.usage !== undefined
        ? {
            input: parsed.usage.prompt_tokens,
            output: parsed.usage.completion_tokens,
            total: parsed.usage.total_tokens,
            unit: "TOKENS" as const,
          }
        : undefined;
    lfGen?.end({
      output: choice ?? parsed,
      usage: lfUsage,
      metadata: { finishReason: parsed.choices[0]?.finish_reason, attempt },
    });

    return parsed;
  }

  throw new Error("chatCompletion: exhausted retries");
}
