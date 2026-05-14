import { createHash } from "crypto";

/**
 * Normalize text for protocol-level hashing and snapshot comparison.
 * CRLF / lone CR → LF so Windows checkouts do not break edit matching.
 */
export function normalizeWorkspaceText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** SHA-256 hex digest with stable prefix for logs and tool args. */
export function workspaceContentHash(normalizedText: string): string {
  const digest = createHash("sha256").update(normalizedText, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function hashRawWorkspaceFile(raw: string): string {
  return workspaceContentHash(normalizeWorkspaceText(raw));
}
