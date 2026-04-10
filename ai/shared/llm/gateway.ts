import type { ChatCompletionParams, ChatCompletionResponse } from "./types";
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

function getApiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set. Check .env.local");
  return { apiKey, baseURL };
}

export async function chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
  const { apiKey, baseURL } = getApiConfig();
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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

    return JSON.parse(bodyText) as ChatCompletionResponse;
  }

  throw new Error("chatCompletion: exhausted retries");
}
