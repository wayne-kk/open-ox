import type { ChatCompletionParams, ChatCompletionResponse } from "./types";

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
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const bodyLower = body.toLowerCase();
      const isUpstreamWrapped400 =
        res.status === 400 &&
        (bodyLower.includes("upstream_error") || bodyLower.includes("bad_response_status_code"));
      const isRetryable =
        res.status === 500 || res.status === 502 || res.status === 503 || isUpstreamWrapped400;

      if (isRetryable && attempt < maxRetries) {
        const delay = 1000 * (attempt + 1);
        console.warn(
          `[chatCompletion] HTTP ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error(`[chatCompletion] HTTP ${res.status} body=${body}`);
      throw new Error(`LLM HTTP ${res.status}: ${body}`);
    }

    return res.json() as Promise<ChatCompletionResponse>;
  }

  throw new Error("chatCompletion: exhausted retries");
}
