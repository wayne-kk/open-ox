export function throwClassifiedLLMError(err: unknown, model: string): never {
  const errObj = err as {
    status?: number;
    code?: string;
    message?: string;
    type?: string;
    cause?: { code?: string; message?: string; cause?: { code?: string; message?: string } };
    error?: { message?: string; type?: string; code?: string };
  };
  const status = errObj.status;
  const code = errObj.code ?? errObj.error?.code ?? errObj.cause?.code;
  const type = errObj.type ?? errObj.error?.type;
  const msg = errObj.error?.message ?? errObj.message ?? String(err);

  const causes: string[] = [];
  let cursor: { message?: string; code?: string; cause?: unknown } | undefined =
    errObj.cause as typeof errObj.cause;
  for (let depth = 0; cursor && depth < 5; depth++) {
    causes.push(`[cause${depth}] ${cursor.code ?? ""} ${cursor.message ?? ""}`);
    cursor = cursor.cause as typeof cursor;
  }
  const causeChain = causes.length > 0 ? ` | causes: ${causes.join(" → ")}` : "";

  console.error(`[LLM ERROR] model=${model} status=${status} code=${code} msg=${msg}${causeChain}`);

  const detail = [
    `Model: ${model}`,
    status ? `HTTP ${status}` : null,
    code ? `code: ${code}` : null,
    type ? `type: ${type}` : null,
    `message: ${msg}`,
    causeChain || null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  ) {
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
