/**
 * Volcano Engine Ark image API (OpenAI-compatible /images/generations).
 * Configure with ARK_API_KEY; optional ARK_BASE_URL, ARK_IMAGE_MODEL, ARK_IMAGE_SIZE.
 */

export interface ArkImageGenerateOptions {
  prompt: string;
  /** e.g. "1k" | "2k" | "4k" or WxH per model docs */
  size?: string;
  /** "png" | "jpeg" — only supported by doubao-seedream-5.0-lite, others default to jpeg */
  outputFormat?: string;
  signal?: AbortSignal;
}

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;

function arkBaseUrl(): string {
  const raw = process.env.ARK_BASE_URL?.trim() || "https://ark.cn-beijing.volces.com/api/v3";
  return raw.replace(/\/$/, "");
}

export function defaultArkModel(): string {
  return process.env.ARK_IMAGE_MODEL?.trim() || "doubao-seedream-4-0-250828";
}

export function normalizeArkImageSize(size: string): string {
  const normalized = size.trim();
  if (!normalized) return "1k";

  // Accept loose K aliases: "2K", "2 k", "size=2k", etc.
  const kMatch = normalized.match(/([124])\s*[kK]\b/);
  if (kMatch) {
    return `${kMatch[1]}k`;
  }

  // Accept WxH aliases with optional spaces / uppercase X.
  const whMatch = normalized.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (whMatch) {
    const width = whMatch[1];
    const height = whMatch[2];
    return `${width}x${height}`;
  }

  // Never pass through unknown values to Ark; fall back to a valid default.
  return "1k";
}

function normalizeArkPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  // Ark side is stricter when prompts get too long; keep within tool contract.
  return normalized.length > 160 ? normalized.slice(0, 160) : normalized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number, bodyText: string): boolean {
  if (status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const lower = bodyText.toLowerCase();
  return lower.includes("upstream_error") || lower.includes("timeout") || lower.includes("temporarily unavailable");
}

export async function generateArkImageBase64(options: ArkImageGenerateOptions): Promise<string> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ARK_API_KEY is not set");
  }

  const size = "1k";
  const prompt = normalizeArkPrompt(options.prompt);
  const url = `${arkBaseUrl()}/images/generations`;

  let lastError = "unknown error";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const signal = options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: defaultArkModel(),
          prompt,
          size,
          response_format: "b64_json",
          watermark: false,
          ...(options.outputFormat ? { output_format: options.outputFormat } : {}),
        }),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Ark image API ${res.status}: ${text.slice(0, 500)}`;
        if (attempt < MAX_RETRIES && shouldRetry(res.status, text)) {
          await sleep(600 * (attempt + 1));
          continue;
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
        error?: { message?: string };
      };

      if (json.error?.message) {
        throw new Error(json.error.message);
      }

      const b64 = json.data?.[0]?.b64_json;
      if (b64) return b64;

      const remoteUrl = json.data?.[0]?.url;
      if (remoteUrl) {
        const imgRes = await fetch(remoteUrl, { signal });
        if (!imgRes.ok) throw new Error("Failed to fetch Ark image URL");
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return buf.toString("base64");
      }

      throw new Error("Ark image API returned no image data");
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await sleep(600 * (attempt + 1));
    }
  }
  throw new Error(lastError);
}
