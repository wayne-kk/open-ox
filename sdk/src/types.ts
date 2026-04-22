/**
 * @open-ox/sdk - Core Type Definitions
 *
 * These types define the public API surface of the SDK.
 * They are decoupled from internal implementation details.
 */

// ─── LLM Configuration ──────────────────────────────────────────────────────

export interface LLMConfig {
  /** OpenAI-compatible API key */
  apiKey: string;
  /** OpenAI-compatible base URL (default: https://api.openai.com/v1) */
  baseURL?: string;
  /** Default model ID for generation steps */
  model?: string;
  /** Model for modification agent (default: same as model) */
  modifyModel?: string;
  /** Per-step model overrides: { "analyze_project_requirement": "gpt-4o", ... } */
  stepModels?: Record<string, string>;
  /** Per-step thinking level overrides */
  stepThinkingLevels?: Record<string, "minimal" | "low" | "medium" | "high">;
  /** Connection timeout in ms (default: 60000) */
  connectTimeoutMs?: number;
  /** Request timeout in ms (default: 300000) */
  requestTimeoutMs?: number;
}

// ─── File System Abstraction ─────────────────────────────────────────────────

export interface FileSystem {
  /** Read a file as UTF-8 string. Throw if not found. */
  readFile(path: string): Promise<string>;
  /** Write content to a file, creating parent directories as needed. */
  writeFile(path: string, content: string): Promise<void>;
  /** Check if a file or directory exists. */
  exists(path: string): Promise<boolean>;
  /** Create directory recursively. */
  mkdir(path: string): Promise<void>;
  /** List files in a directory (non-recursive). */
  readdir(path: string): Promise<string[]>;
  /** Delete a file. */
  unlink(path: string): Promise<void>;
  /** Read file, return null if not found (convenience). */
  tryReadFile?(path: string): Promise<string | null>;
}

// ─── Shell Executor Abstraction ──────────────────────────────────────────────

export interface ShellExecutor {
  /** Execute a shell command and return stdout. */
  exec(command: string, options?: ShellExecOptions): Promise<ShellExecResult>;
}

export interface ShellExecOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
}

export interface ShellExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ─── Prompt Loader Abstraction ───────────────────────────────────────────────

export interface PromptLoader {
  /** Load a prompt by kind and id. Return the prompt content string. */
  loadPrompt(kind: PromptKind, id: string): Promise<string>;
  /** Check if a prompt exists. */
  hasPrompt(kind: PromptKind, id: string): Promise<boolean>;
}

export type PromptKind =
  | "step"
  | "section"
  | "skill"
  | "guardrail"
  | "system"
  | "motion"
  | "layout"
  | "capability"
  | "modify-system";

// ─── Generation Options ──────────────────────────────────────────────────────

export interface GenerateProjectOptions {
  /** User's natural language description of the project */
  prompt: string;
  /**
   * Directory name under `outputDir` for this generation.
   * If omitted, a unique id is generated automatically.
   */
  projectId?: string;
  /** Style guide text to influence design system generation */
  styleGuide?: string;
  /** Generation mode: "web" for website, "app" for application */
  mode?: "web" | "app";
  /** Enable section skill selection during generation */
  enableSkills?: boolean;
  /** Model override (e.g. "gpt-4o") */
  model?: string;
  /** Callback for real-time step progress */
  onStep?: (step: BuildStep) => void;
}

export interface ModifyProjectOptions {
  /** Unique project ID of the existing project */
  projectId: string;
  /** User's modification instruction */
  instruction: string;
  /** Conversation history for context */
  conversationHistory?: Array<{ instruction: string; summary: string }>;
  /** Clear previous conversation context */
  clearContext?: boolean;
  /** Base64-encoded image for visual reference */
  imageBase64?: string;
  /** Model override for this modification */
  model?: string;
  /** Callback for real-time events */
  onEvent?: (event: ModifyEvent) => void;
}

// ─── Generation Results ──────────────────────────────────────────────────────

export interface GenerateProjectResult {
  success: boolean;
  verificationStatus: "passed" | "failed";
  /** Generated project ID */
  projectId?: string;
  /** Absolute path to the generated project directory */
  projectPath?: string;
  /** Full project blueprint with all planning details */
  blueprint?: PlannedProjectBlueprint;
  /** List of all generated file paths (relative to project root) */
  generatedFiles: string[];
  /** Files that failed build verification */
  unvalidatedFiles: string[];
  /** Auto-installed npm dependencies */
  installedDependencies: AutoInstalledDependency[];
  /** Dependencies that failed to install */
  dependencyInstallFailures: DependencyInstallFailure[];
  /** Step-by-step execution trace */
  steps: BuildStep[];
  /** Log directory path */
  logDirectory?: string;
  /** Total generation time in ms */
  totalDuration?: number;
  /** Error message if failed */
  error?: string;
  /** Raw build output */
  verificationOutput?: string;
}

export interface ModifyEvent {
  type: "step" | "plan" | "diff" | "tool_call" | "thinking" | "done" | "error";
  [key: string]: unknown;
}

// ─── Build Steps ─────────────────────────────────────────────────────────────

export interface BuildStep {
  step: string;
  status: "ok" | "error" | "active";
  detail?: string;
  timestamp: number;
  duration: number;
  skillId?: string | null;
  trace?: StepTrace;
}

export interface StepTrace {
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  llmCall?: {
    model?: string;
    thinkingLevel?: string;
    systemPrompt?: string;
    userMessage?: string;
    rawResponse?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
  validationResult?: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail?: string }>;
  };
}

// ─── Blueprint Types ─────────────────────────────────────────────────────────

export interface PlannedProjectBlueprint {
  brief: ProjectBrief;
  experience: ProjectExperience;
  site: PlannedProjectSiteBlueprint;
  projectGuardrailIds: string[];
}

export interface ProjectBrief {
  projectTitle: string;
  projectDescription: string;
  language: string;
  productScope: ProductScope;
  roles: UserRole[];
  taskLoops: TaskLoop[];
  capabilities: CapabilitySpec[];
}

export interface ProductScope {
  productType: string;
  mvpDefinition: string;
  coreOutcome: string;
  businessGoal: string;
  audienceSummary: string;
  inScope: string[];
  outOfScope: string[];
  journeyStageHints?: string[];
}

export interface UserRole {
  roleId: string;
  roleName: string;
  summary: string;
  goals: string[];
  coreActions: string[];
  permissions: string[];
  priority: "primary" | "secondary" | "supporting";
}

export interface TaskLoop {
  loopId: string;
  roleId: string;
  name: string;
  summary: string;
  entryTrigger: string;
  steps: string[];
  successState: string;
  relatedCapabilityIds: string[];
}

export interface CapabilitySpec {
  capabilityId: string;
  name: string;
  summary: string;
  primaryRoleIds: string[];
  supportingTaskLoopIds: string[];
  priority: "must-have" | "should-have" | "nice-to-have";
}

export interface ProjectExperience {
  designIntent: DesignIntent;
}

export interface DesignIntent {
  mood: string[];
  colorDirection: string;
  style: string;
  keywords: string[];
}

export interface PlannedProjectSiteBlueprint {
  informationArchitecture: InformationArchitecture;
  layoutSections: SectionSpec[];
  pages: PlannedPageBlueprint[];
}

export interface InformationArchitecture {
  navigationModel: string;
  pageMap: PageMapEntry[];
  sharedShells: string[];
  notes: string[];
}

export interface PageMapEntry {
  slug: string;
  title: string;
  purpose: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  journeyStage: string;
}

export interface SectionSpec {
  type: string;
  intent: string;
  contentHints: string;
  fileName: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  sourceTaskLoopIds: string[];
}

export interface PlannedPageBlueprint {
  title: string;
  slug: string;
  description: string;
  journeyStage: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  pageDesignPlan: PageDesignPlan;
  sections: SectionSpec[];
}

export interface PageDesignPlan {
  pageGoal: string;
  narrativeArc: string;
  layoutStrategy: string;
  hierarchy: string[];
  constraints: string[];
}

export interface AutoInstalledDependency {
  packageName: string;
  dev: boolean;
  trigger: "generated-import";
  files: string[];
}

export interface DependencyInstallFailure extends AutoInstalledDependency {
  error: string;
}
