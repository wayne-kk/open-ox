/**
 * @open-ox/sdk - OpenOxClient
 *
 * Self-contained SDK client. The generation engine is bundled inside the package.
 * Only requires an OpenAI-compatible API key and an output directory.
 */

import type {
  GenerateProjectOptions,
  GenerateProjectResult,
  BuildStep,
} from "./types";

export interface OpenOxClientConfig {
  /**
   * OpenAI-compatible API key.
   */
  apiKey: string;

  /**
   * OpenAI-compatible API base URL.
   * Default: "https://api.openai.com/v1"
   */
  baseURL?: string;

  /**
   * Default model for all generation steps.
   * Default: "gpt-4o-mini"
   */
  model?: string;

  /**
   * Per-step model overrides.
   * Example: { "analyze_project_requirement": "gpt-4o", "generate_section": "gpt-4o-mini" }
   */
  stepModels?: Record<string, string>;

  /**
   * Per-step thinking level overrides.
   * Example: { "plan_project": "high" }
   */
  stepThinkingLevels?: Record<string, "minimal" | "low" | "medium" | "high">;

  /**
   * Image generation API key (Volcano Engine Ark).
   * If not set, image generation will be skipped.
   */
  imageApiKey?: string;

  /**
   * Image generation API base URL.
   * Default: "https://ark.cn-beijing.volces.com/api/v3"
   */
  imageBaseURL?: string;

  /**
   * Image generation model.
   * Default: "doubao-seedream-4-0-250828"
   */
  imageModel?: string;

  /**
   * Root directory where projects are generated.
   * Each project gets a subdirectory: `${outputDir}/${projectId}/`
   */
  outputDir: string;
}

function validateConfig(config: OpenOxClientConfig): void {
  if (!config.apiKey) {
    throw new Error("OpenOxClient: apiKey is required");
  }
  if (!config.outputDir) {
    throw new Error("OpenOxClient: outputDir is required");
  }
}

/** Safe directory segment under outputDir (no path separators or ".."). */
function resolveProjectId(explicit: string | undefined): string {
  if (explicit !== undefined && explicit.trim() !== "") {
    const id = explicit.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new Error("OpenOxClient: projectId may only contain letters, digits, ., _, -");
    }
    return id;
  }
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function listFilesUnderDir(rootDir: string): Promise<string[]> {
  const path = await import("path");
  const fs = await import("fs/promises");
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        out.push(path.relative(rootDir, full).split(path.sep).join("/"));
      }
    }
  }
  await walk(rootDir);
  return out.sort();
}

/**
 * Open OX SDK — generate complete Next.js projects from natural language.
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
 *   onStep: (step) => console.log(`[${step.status}] ${step.step}`),
 * });
 * ```
 */
export class OpenOxClient {
  private config: OpenOxClientConfig;

  constructor(config: OpenOxClientConfig) {
    validateConfig(config);
    this.config = config;
  }

  /**
   * Generate a new project from a natural language description.
   */
  async generate(options: GenerateProjectOptions): Promise<GenerateProjectResult> {
    const { join } = await import("path");
    const { mkdirSync, existsSync } = await import("fs");

    const projectId = resolveProjectId(options.projectId);
    const projectPath = join(this.config.outputDir, projectId);

    if (!existsSync(projectPath)) {
      mkdirSync(projectPath, { recursive: true });
    }

    // 1. Scaffold the project directory with template files
    const { scaffoldProject } = await import("./scaffold");
    scaffoldProject(projectPath);

    // 2. Setup environment
    const prev = this.setupEnv(projectPath);

    // 3. Configure models
    const models = await import("./engine/shims/models");
    models.setRuntimeModelId(this.config.model ?? null);
    models.clearStepModels();
    if (this.config.stepModels) {
      for (const [step, model] of Object.entries(this.config.stepModels)) {
        models.setStepModel(step, model);
      }
    }
    if (this.config.stepThinkingLevels) {
      for (const [step, level] of Object.entries(this.config.stepThinkingLevels)) {
        models.setStepThinkingLevel(step, level);
      }
    }

    // 4. Set site root
    const { setSiteRoot, clearSiteRoot } = await import("./engine/tools/system/common");
    setSiteRoot(projectPath);

    try {
      // 5. Run generation
      const { runGenerateProject } = await import("./engine/flows/generate_project/runGenerateProject");
      const { withPromptProfile } = await import("./engine/prompts/core/profile");
      const profile = options.mode === "app" ? "app" : "web";

      const result = await withPromptProfile(profile, () =>
        runGenerateProject(options.prompt, options.onStep, {
          projectId,
          styleGuide: options.styleGuide,
          enableSkills: false,
        })
      );

      return {
        ...result,
        projectId,
        projectPath,
      } as GenerateProjectResult;
    } finally {
      clearSiteRoot();
      models.setRuntimeModelId(null);
      models.clearStepModels();
      this.restoreEnv(prev);
    }
  }

  /**
   * Get the output path for a project.
   */
  getProjectPath(projectId: string): string {
    return `${this.config.outputDir}/${projectId}`;
  }

  /**
   * List relative file paths under the project directory (recursive).
   * Returns an empty array if the project directory does not exist.
   */
  async listProjectFiles(projectId: string): Promise<string[]> {
    const path = await import("path");
    const { existsSync } = await import("fs");
    const root = path.join(this.config.outputDir, projectId);
    if (!existsSync(root)) {
      return [];
    }
    return listFilesUnderDir(root);
  }

  /**
   * Read a UTF-8 file from the project directory. `relativePath` is relative to the project root.
   */
  async readProjectFile(projectId: string, relativePath: string): Promise<string> {
    const path = await import("path");
    const fs = await import("fs/promises");
    const root = path.resolve(this.config.outputDir, projectId);
    const target = path.resolve(root, relativePath);
    const rel = path.relative(root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error("OpenOxClient: invalid file path");
    }
    return fs.readFile(target, "utf-8");
  }

  private setupEnv(projectPath: string) {
    const prev = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_API_URL: process.env.OPENAI_API_URL,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      ARK_API_KEY: process.env.ARK_API_KEY,
      ARK_BASE_URL: process.env.ARK_BASE_URL,
      ARK_IMAGE_MODEL: process.env.ARK_IMAGE_MODEL,
    };
    process.env.OPENAI_API_KEY = this.config.apiKey;
    if (this.config.baseURL) process.env.OPENAI_API_URL = this.config.baseURL;
    if (this.config.model) process.env.OPENAI_MODEL = this.config.model;
    if (this.config.imageApiKey) process.env.ARK_API_KEY = this.config.imageApiKey;
    if (this.config.imageBaseURL) process.env.ARK_BASE_URL = this.config.imageBaseURL;
    if (this.config.imageModel) process.env.ARK_IMAGE_MODEL = this.config.imageModel;
    return prev;
  }

  private restoreEnv(prev: Record<string, string | undefined>) {
    for (const [key, val] of Object.entries(prev)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  }
}
