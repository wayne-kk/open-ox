import type { ChromeForm, SharedContract } from "./shared/chromeForm";

export type { ChromeForm, SharedContract };

export interface SectionSpec {
  type: string;
  intent: string;
  contentHints: string;
  fileName: string;
  primaryRoleIds?: string[];
  supportingCapabilityIds?: string[];
  sourceTaskLoopIds?: string[];
}

export type GuardrailId = string;
export type ShellPlacement = "beforePageContent" | "afterPageContent";

export type RolePriority = "primary" | "secondary" | "supporting";
export type CapabilityPriority = "must-have" | "should-have" | "nice-to-have";

export interface ProductScope {
  productType: string;
  mvpDefinition: string;
  coreOutcome: string;
  businessGoal: string;
  audienceSummary: string;
  inScope: string[];
  outOfScope: string[];
}

export interface UserRole {
  roleId: string;
  roleName: string;
  summary: string;
  goals: string[];
  coreActions: string[];
  permissions: string[];
  priority: RolePriority;
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
  priority: CapabilityPriority;
}

export interface PageMapEntry {
  slug: string;
  title: string;
  purpose: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  journeyStage: string;
}

export interface InformationArchitecture {
  navigationModel: string;
  pageMap: PageMapEntry[];
  sharedShells: string[];
  notes: string[];
  /**
   * Plan-selected shell form for chrome-first scaffold.
   * @see docs/product/chrome-first-generate-pipeline-architecture.md
   */
  chromeForm?: ChromeForm | string;
  /** List/detail shared entity contracts — stubbed before parallel page agents. */
  sharedContracts?: SharedContract[];
}

/** PlannedSectionSpec is now identical to SectionSpec — kept as alias for downstream compat. */
export type PlannedSectionSpec = SectionSpec;

/** How an attached screenshot should influence generation (from user text + presence of image). */
export type ScreenshotIntentMode = "none" | "extract_inspiration" | "replicate_layout";

/** Scoring metadata for hero/component skill picker (LLM-assisted selection). */
export type ComponentSkillScore = {
  id: string;
  priority: number;
  score: number;
  reasons: string[];
  matchedKeywords: string[];
  excludedKeywords: string[];
};

/** Project context forwarded to page implement agent. */
export type PageAgentProjectContext = {
  projectTitle: string;
  projectDescription: string;
  language: string;
  rawUserInput?: string;
  pages: Array<{
    slug: string;
    title: string;
    description: string;
    journeyStage: string;
  }>;
  designKeywords: string[];
  /** Organized user-provided facts (in-memory for pipeline; on disk see content/user-provided.md). */
  userProvidedContent?: UserProvidedContent;
  /** When set, page/architect agents receive the same screenshot for layout-faithful implementation. */
  referenceScreenshotDataUrl?: string | null;
  /** Resolved from user wording when a reference image is present; drives screenshot guardrail policy. */
  screenshotIntentMode?: ScreenshotIntentMode;
};

export type PageAgentPageContext = {
  title: string;
  slug: string;
  description: string;
  journeyStage: string;
};

export interface DesignIntent {
  mood: string[];
  colorDirection: string;
  style: string;
  keywords: string[];
}

export interface PageBlueprint {
  title: string;
  slug: string;
  description: string;
  journeyStage: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  sections: SectionSpec[];
}

export interface PageDesignPlan {
  pageGoal: string;
  narrativeArc: string;
  layoutStrategy: string;
  hierarchy: string[];
  constraints: string[];
}

export interface PlannedPageBlueprint extends Omit<PageBlueprint, "sections"> {
  pageDesignPlan: PageDesignPlan;
  sections: PlannedSectionSpec[];
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

export interface ProjectExperience {
  designIntent: DesignIntent;
}

export interface ProjectSiteBlueprint {
  informationArchitecture: InformationArchitecture;
  pages: PageBlueprint[];
}

/** Image the user provided in their prompt. After resolve, `path` is a project-relative URL like `/images/foo.png`. */
export interface UserProvidedImage {
  url: string;
  caption?: string;
  role?: string;
  /** Project-relative path under public/images/ — same contract as generate_image. */
  path?: string;
  /** How `path` was obtained — only set after a successful download in resolve step. */
  source?: "download";
  /** Present when both download and generate failed. */
  error?: string;
}

export interface UserProvidedTestimonial {
  quote: string;
  author?: string;
  stars?: number | string;
  relativeTime?: string;
}

export interface UserProvidedBusiness {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: string;
  reviewCount?: string;
}

export interface UserProvidedLink {
  label?: string;
  url: string;
}

/**
 * Facts/assets extracted from the user prompt during analyze.
 * Optional — when absent or empty, generation behaves as before.
 */
export interface UserProvidedContent {
  business?: UserProvidedBusiness;
  hours?: string[];
  palette?: string[];
  menuItems?: string[];
  testimonials?: UserProvidedTestimonial[];
  images?: UserProvidedImage[];
  links?: UserProvidedLink[];
  notes?: string;
}

export interface ProjectBlueprint {
  brief: ProjectBrief;
  experience: ProjectExperience;
  site: ProjectSiteBlueprint;
  userProvidedContent?: UserProvidedContent;
}

export interface PlannedProjectSiteBlueprint
  extends Omit<ProjectSiteBlueprint, "pages"> {
  pages: PlannedPageBlueprint[];
}

export interface PlannedProjectBlueprint
  extends Omit<ProjectBlueprint, "site"> {
  site: PlannedProjectSiteBlueprint;
}

export interface StepTraceInput {
  [key: string]: unknown;
}

export interface StepTraceOutput {
  [key: string]: unknown;
}

export interface StepLlmCall {
  model?: string;
  thinkingLevel?: string;
  systemPrompt?: string;
  userMessage?: string;
  rawResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StepTrace {
  input?: StepTraceInput;
  output?: StepTraceOutput;
  llmCall?: StepLlmCall;
  validationResult?: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail?: string }>;
  };
}

export type ProjectIntentGuideOutcome = "continue_build" | "guide_user";

export type ProjectIntentGuidePhase =
  | "meta_capability"
  | "clarify"
  | "confirm_summary"
  | "choices"
  | "build_ready";

export interface ProjectIntentGuideResult {
  outcome: ProjectIntentGuideOutcome;
  phase: ProjectIntentGuidePhase;
  assistantMessage: string;
  suggestedReplies: string[];
  buildPromptAppendix: string | null;
  trace: StepTrace;
}

export interface BuildStep {
  step: string;
  status: "ok" | "error" | "active";
  detail?: string;
  timestamp: number;
  duration: number;
  skillId?: string | null;
  trace?: StepTrace;
}

export type VerificationStatus = "passed" | "failed";
export type DependencyInstallTrigger = "generated-import";

export interface AutoInstalledDependency {
  packageName: string;
  dev: boolean;
  trigger: DependencyInstallTrigger;
  files: string[];
}

export interface DependencyInstallFailure extends AutoInstalledDependency {
  error: string;
}

export interface GenerateProjectResult {
  success: boolean;
  verificationStatus: VerificationStatus;
  blueprint?: PlannedProjectBlueprint;
  generatedFiles: string[];
  unvalidatedFiles: string[];
  installedDependencies: AutoInstalledDependency[];
  dependencyInstallFailures: DependencyInstallFailure[];
  steps: BuildStep[];
  logDirectory?: string;
  totalDuration?: number;
  error?: string;
  verificationOutput?: string;
  intentGuideDeferred?: boolean;
  intentGuide?: ProjectIntentGuideResult;
}

export interface BuildVerificationResult {
  success: boolean;
  output: string;
}

export interface RepairWrite {
  path: string;
  content: string;
}

export interface BuildRepairResult {
  success: boolean;
  output: string;
  touchedFiles: string[];
}
