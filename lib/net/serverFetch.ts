import { Agent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

function parseTimeoutMs(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const DEFAULT_CONNECT_MS = 60_000;
const DEFAULT_HEADERS_MS = 60_000;
const DEFAULT_BODY_MS = 120_000;

const connectTimeoutMs = parseTimeoutMs(
  process.env.IMAGE_FETCH_CONNECT_TIMEOUT_MS,
  DEFAULT_CONNECT_MS
);
const headersTimeoutMs = parseTimeoutMs(
  process.env.IMAGE_FETCH_HEADERS_TIMEOUT_MS,
  DEFAULT_HEADERS_MS
);
const bodyTimeoutMs = parseTimeoutMs(process.env.IMAGE_FETCH_BODY_TIMEOUT_MS, DEFAULT_BODY_MS);

let dispatcher: Dispatcher | undefined;

function getDispatcher(): Dispatcher {
  if (!dispatcher) {
    const proxy = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
    if (proxy) {
      console.log(`[serverFetch] using proxy ${proxy.replace(/:[^:@/]+@/, ":***@")}`);
      dispatcher = new ProxyAgent(proxy);
    } else {
      dispatcher = new Agent({
        connect: { timeout: connectTimeoutMs },
        headersTimeout: headersTimeoutMs,
        bodyTimeout: bodyTimeoutMs,
      });
    }
  }
  return dispatcher;
}

/** Node fetch with long timeouts + optional HTTPS_PROXY (browser VPN does not apply to Node by default). */
export async function serverFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await undiciFetch(input, {
    ...init,
    dispatcher: getDispatcher(),
  });
  return res as unknown as Response;
}

/** Surface undici cause (e.g. Connect Timeout) instead of bare "fetch failed". */
export function formatFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const parts: string[] = [err.message];
  const cause = err.cause;
  if (cause instanceof Error && cause.message && !parts.includes(cause.message)) {
    parts.push(cause.message);
  } else if (cause && typeof cause === "object") {
    const code = "code" in cause ? String((cause as { code?: string }).code) : "";
    const host = "hostname" in cause ? String((cause as { hostname?: string }).hostname) : "";
    if (code) parts.push(code);
    if (host) parts.push(host);
  }

  const text = parts.join(" — ");
  if (/connect timeout|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(text)) {
    return (
      `${text}. ` +
      "Node cannot reach this host (browser may still work via VPN). " +
      "Set HTTPS_PROXY in .env.local to match your browser proxy, or use remote image URLs in the page."
    );
  }
  return text;
}
