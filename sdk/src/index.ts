/**
 * @open-ox/sdk
 *
 * Generate complete Next.js projects from natural language descriptions.
 * Self-contained — only requires an OpenAI-compatible API key.
 *
 * @example
 * ```ts
 * import { OpenOxClient } from "@open-ox/sdk";
 *
 * const client = new OpenOxClient({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   outputDir: "./projects",
 * });
 *
 * const result = await client.generate({
 *   prompt: "A landing page for a coffee shop",
 * });
 * ```
 *
 * @packageDocumentation
 */

export { OpenOxClient } from "./client";
export type { OpenOxClientConfig } from "./client";

export type {
  GenerateProjectOptions,
  GenerateProjectResult,
  BuildStep,
  StepTrace,
  PlannedProjectBlueprint,
  ProjectBrief,
  DesignIntent,
  SectionSpec,
  AutoInstalledDependency,
  DependencyInstallFailure,
} from "./types";
