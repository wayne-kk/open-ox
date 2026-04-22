/**
 * @open-ox/sdk - OpenOxClient
 *
 * Self-contained SDK client. The generation engine is bundled inside the package.
 * Only requires an OpenAI-compatible API key and an output directory.
 */

import type {
  GenerateProjectOptions,
  GenerateProjectResult,
} from "./types";

export interface OpenOxClientConfig {
  /** OpenAI-compatible API key. */
  apiKey: string;
  /** OpenAI-compatible API base URL. Default: "https://api.openai.com/v1" */
  baseURL?: string;
  /** Default model for all generation steps. Default: "gpt-4o-mini" */
  model?: string;
  /** Per-step model overrides. */
  stepModels?: Record<string, string>;
  /** Per-step thinking level overrides. */
  stepThinkingLevels?: Record<string, "minimal" | "low" | "medium" | "high">;
  /** Image generation API key (Volcano Engine Ark). If not set, images use placeholders. */
  imageApiKey?: string;
  /** Image generation API base URL. */
  imageBaseURL?: string;
  /** Image generation model. */
  imageModel?: string;
  /** Root directory where projects are generated. */
  outputDir: string;
  /**
   * Path to a pre-installed template directory with node_modules.
   * If set, SDK symlinks node_modules from here instead of running npm install.
   * If not set, SDK auto-installs on first run and caches for reuse.
   */
  templateDir?: string;
}

function validateConfig(config: OpenOxClientConfig): void {
  if (!config.apiKey) throw new Error("OpenOxClient: apiKey is required");
  if (!config.outputDir) throw new Error("OpenOxClient: outputDir is required");
}

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
    const path = await import("path");
    const fs = await import("fs");

    const projectId = resolveProjectId(options.projectId);
    const projectPath = path.resolve(this.config.outputDir, projectId);

    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // 1. Scaffold project
    const { scaffoldProject } = await import("./scaffold");
    scaffoldProject(projectPath);

    // 2. Ensure node_modules
    await this.ensureDependencies(projectPath);

    // 3. Setup environment
    const envRestore = this.setupEnv();

    // 4. Configure models
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

    // 5. Set site root
    const { setSiteRoot, clearSiteRoot } = await import("./engine/tools/system/common");
    setSiteRoot(projectPath);

    try {
      // 6. Run generation
      const { runGenerateProject } = await import("./engine/flows/generate_project/runGenerateProject");
      const { withPromptProfile } = await import("./engine/prompts/core/profile");
      const profile = options.mode === "app" ? "app" : "web";

      const result = await withPromptProfile(profile, () =>
        runGenerateProject(options.prompt, options.onStep, {
          projectId,
          styleGuide: options.styleGuide,
          enableSkills: options.enableSkills ?? false,
        })
      );

      return { ...result, projectId, projectPath } as GenerateProjectResult;
    } finally {
      clearSiteRoot();
      models.setRuntimeModelId(null);
      models.clearStepModels();
      envRestore();
    }
  }

  getProjectPath(projectId: string): string {
    return `${this.config.outputDir}/${projectId}`;
  }

  async listProjectFiles(projectId: string): Promise<string[]> {
    const path = await import("path");
    const fsP = await import("fs/promises");
    const fs = await import("fs");
    const root = path.join(this.config.outputDir, projectId);
    if (!fs.existsSync(root)) return [];
    const out: string[] = [];
    async function walk(dir: string) {
      for (const e of await fsP.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".next") {
          await walk(full);
        } else if (e.isFile()) {
          out.push(path.relative(root, full).split(path.sep).join("/"));
        }
      }
    }
    await walk(root);
    return out.sort();
  }

  async readProjectFile(projectId: string, relativePath: string): Promise<string> {
    const path = await import("path");
    const fsP = await import("fs/promises");
    const root = path.resolve(this.config.outputDir, projectId);
    const target = path.resolve(root, relativePath);
    if (!target.startsWith(root)) throw new Error("OpenOxClient: invalid file path");
    return fsP.readFile(target, "utf-8");
  }

  // ─── Dependency Management ───────────────────────────────────────────────

  /**
   * Ensures node_modules exists in the project directory.
   *
   * Strategy:
   * 1. If user provided templateDir with node_modules → symlink
   * 2. If outputDir has a cached _node_modules_cache → symlink
   * 3. Otherwise → npm install + cache for next time
   */
  private async ensureDependencies(projectPath: string): Promise<void> {
    const path = await import("path");
    const fs = await import("fs");

    const nodeModulesPath = path.join(projectPath, "node_modules");

    // Already has node_modules? Skip.
    if (fs.existsSync(nodeModulesPath)) return;

    // Option 1: User-provided templateDir
    if (this.config.templateDir) {
      const templateModules = path.resolve(this.config.templateDir, "node_modules");
      if (fs.existsSync(templateModules)) {
        console.log("[open-ox-sdk] Linking node_modules from templateDir...");
        fs.symlinkSync(templateModules, nodeModulesPath, "junction");
        return;
      }
      console.warn("[open-ox-sdk] templateDir has no node_modules, falling back to install");
    }

    // Option 2: Cached node_modules in outputDir
    const cachePath = path.resolve(this.config.outputDir, "_node_modules_cache");
    if (fs.existsSync(cachePath)) {
      console.log("[open-ox-sdk] Linking node_modules from cache...");
      fs.symlinkSync(cachePath, nodeModulesPath, "junction");
      return;
    }

    // Option 3: Fresh install + cache
    console.log("[open-ox-sdk] Installing dependencies (first run, will be cached)...");
    const { execSync } = await import("child_process");
    try {
      execSync("npm install --prefer-offline --no-audit --no-fund --loglevel=error", {
        cwd: projectPath,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300_000,
        encoding: "utf-8",
      });
      console.log("[open-ox-sdk] Dependencies installed, caching for future use...");

      // Move node_modules to cache, then symlink back
      fs.renameSync(nodeModulesPath, cachePath);
      fs.symlinkSync(cachePath, nodeModulesPath, "junction");
      console.log("[open-ox-sdk] Cache created at", cachePath);
    } catch (err: any) {
      // Install failed but might have partial node_modules — keep going
      console.warn("[open-ox-sdk] npm install had issues:", err.stderr?.slice(0, 300) ?? err.message);
    }
  }

  // ─── Environment ─────────────────────────────────────────────────────────

  private setupEnv(): () => void {
    const snapshot: Record<string, string | undefined> = {};
    const set = (key: string, val: string | undefined) => {
      snapshot[key] = process.env[key];
      if (val !== undefined) process.env[key] = val;
    };

    set("OPENAI_API_KEY", this.config.apiKey);
    set("OPENAI_API_URL", this.config.baseURL);
    set("OPENAI_MODEL", this.config.model);
    set("ARK_API_KEY", this.config.imageApiKey);
    set("ARK_BASE_URL", this.config.imageBaseURL);
    set("ARK_IMAGE_MODEL", this.config.imageModel);

    return () => {
      for (const [key, val] of Object.entries(snapshot)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    };
  }
}
