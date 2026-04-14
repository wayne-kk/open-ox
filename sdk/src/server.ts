/**
 * @open-ox/sdk/server - Node.js Server Adapters
 *
 * Provides default implementations of FileSystem, ShellExecutor,
 * and PromptLoader using Node.js built-in modules.
 *
 * Usage:
 * ```ts
 * import { OpenOxClient } from "@open-ox/sdk";
 * import { createNodeAdapters } from "@open-ox/sdk/server";
 *
 * const client = new OpenOxClient({
 *   llm: { apiKey: "sk-..." },
 *   projectsRoot: "./projects",
 *   ...createNodeAdapters(),
 * });
 * ```
 */

export { NodeFileSystem, createNodeFileSystem } from "./adapters/nodeFs";
export { NodeShellExecutor, createNodeShellExecutor } from "./adapters/nodeShell";
export { FilePromptLoader, createFilePromptLoader } from "./adapters/filePromptLoader";
export { createNodeAdapters } from "./adapters";
export { createHttpServer, type HttpServerOptions } from "./adapters/httpServer";
export { scaffoldProject } from "./scaffold";
