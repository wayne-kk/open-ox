/**
 * Convenience factory that creates all Node.js adapters at once.
 */

import { createNodeFileSystem } from "./nodeFs";
import { createNodeShellExecutor } from "./nodeShell";
import type { FileSystem, ShellExecutor } from "../types";

export interface NodeAdapters {
  fileSystem: FileSystem;
  shellExecutor: ShellExecutor;
}

/**
 * Create all Node.js adapters with sensible defaults.
 *
 * @example
 * ```ts
 * const client = new OpenOxClient({
 *   apiKey: "sk-...",
 *   outputDir: "./projects",
 * });
 * ```
 */
export function createNodeAdapters(): NodeAdapters {
  return {
    fileSystem: createNodeFileSystem(),
    shellExecutor: createNodeShellExecutor(),
  };
}
