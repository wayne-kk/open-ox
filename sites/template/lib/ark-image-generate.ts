/**
 * Volcano Engine Ark image API (OpenAI-compatible /images/generations).
 * Configure with ARK_API_KEY; optional ARK_BASE_URL, ARK_IMAGE_MODEL, ARK_IMAGE_SIZE.
 */

export interface ArkImageGenerateOptions {
  prompt: string;
  /** e.g. "1k" | "2k" | "4k" or WxH per model docs */
  size?: string;
  signal?: AbortSignal;
}

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
  const kMatch = normalized.match(/([124])\s*[kK]\b/);
  if (kMatch) {
    return `${kMatch[1]}k`;
  }
  const whMatch = normalized.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (whMatch) {
    return `${whMatch[1]}x${whMatch[2]}`;
  }
  return "1k";
}

export function defaultArkSize(needLargeImage: boolean): string {
  const fixed = process.env.ARK_IMAGE_SIZE?.trim();
  if (fixed) return normalizeArkImageSize(fixed);
  return needLargeImage ? "2k" : "1k";
}

export async function generateArkImageBase64(options: ArkImageGenerateOptions): Promise<string> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ARK_API_KEY is not set");
  }

  const size = normalizeArkImageSize(options.size ?? defaultArkSize(true));
  const url = `${arkBaseUrl()}/images/generations`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: defaultArkModel(),
      prompt: options.prompt,
      size,
      response_format: "b64_json",
      watermark: false,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ark image API ${res.status}: ${text.slice(0, 500)}`);
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
    const imgRes = await fetch(remoteUrl, { signal: options.signal });
    if (!imgRes.ok) throw new Error("Failed to fetch Ark image URL");
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return buf.toString("base64");
  }

  throw new Error("Ark image API returned no image data");
}
