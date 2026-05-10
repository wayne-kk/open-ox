/**
 * Tracks which files the agent has written to in the current session.
 * Used by `read_lints` (and future verification helpers) to know which
 * generated files are worth re-checking when the agent asks "what's broken?".
 *
 * Intentionally module-level mirroring `fileReadTracker` so existing flows
 * keep working without ALS plumbing. Cleared at the boundary of every
 * generate / modify run via {@link clearFileWriteTracking}.
 */

const _writtenFiles: Set<string> = new Set<string>();

export function trackFileWrite(filePath: string): void {
  _writtenFiles.add(filePath);
}

export function listRecentlyWrittenFiles(): string[] {
  return Array.from(_writtenFiles);
}

export function clearFileWriteTracking(): void {
  _writtenFiles.clear();
}
