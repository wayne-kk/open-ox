/**
 * Tracks which files the agent has read in the current session.
 * Used by edit_file to enforce "must read before edit" (Claude Code pattern).
 * 
 * Extracted to its own module to avoid circular dependency between
 * systemTools.ts and editFileTool.ts.
 */

const _readFiles = new Set<string>();

export function trackFileRead(filePath: string): void {
  _readFiles.add(filePath);
}

export function hasFileBeenRead(filePath: string): boolean {
  return _readFiles.has(filePath);
}

export function clearFileReadTracking(): void {
  _readFiles.clear();
}
