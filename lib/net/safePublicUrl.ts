import dns from "node:dns/promises";
import net from "node:net";

/**
 * Block obviously private / local addresses after DNS resolution.
 * Used before server-side fetch to reduce SSRF risk.
 */

function isIPv4Private(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isIPv6Private(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

const hostSafetyCache = new Map<string, Promise<void>>();

/** Clear DNS host cache (tests). */
export function clearHostSafetyCache(): void {
  hostSafetyCache.clear();
}

async function assertHostnameSafe(host: string): Promise<void> {
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal" ||
    lower.endsWith(".internal")
  ) {
    throw new Error("Host is not allowed");
  }

  if (net.isIPv4(host)) {
    if (isIPv4Private(host)) throw new Error("Private IPv4 address is not allowed");
    return;
  }
  if (net.isIPv6(host)) {
    if (isIPv6Private(host)) throw new Error("Private IPv6 address is not allowed");
    return;
  }

  const records = await dns.lookup(host, { all: true });
  if (records.length === 0) {
    throw new Error("Could not resolve host");
  }
  for (const r of records) {
    if (net.isIPv4(r.address) && isIPv4Private(r.address)) {
      throw new Error("Host resolves to a private IPv4 address");
    }
    if (net.isIPv6(r.address) && isIPv6Private(r.address)) {
      throw new Error("Host resolves to a non-public IPv6 address");
    }
  }
}

async function assertHostnameSafeCached(host: string): Promise<void> {
  let pending = hostSafetyCache.get(host);
  if (!pending) {
    pending = assertHostnameSafe(host);
    hostSafetyCache.set(host, pending);
  }
  await pending;
}

/**
 * Throws if URL is not safe to fetch from the server (SSRF guard).
 * Resolves DNS and rejects if any A/AAAA record points to a non-public address.
 * Hostname checks are cached for the process lifetime (safe for repeated CDN fetches).
 */
export async function assertUrlSafeForServerFetch(href: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    throw new Error("Invalid URL");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (u.username || u.password) {
    throw new Error("URL must not include credentials");
  }

  const host = u.hostname;
  if (!host) throw new Error("Missing host");

  await assertHostnameSafeCached(host);

  return u;
}
