export interface SectionSpec {
  type: string;
  intent: string;
  contentHints: string;
  fileName: string;
  primaryRoleIds: string[];
  supportingCapabilityIds: string[];
  sourceTaskLoopIds: string[];
}

export type GuardrailId = string;
export type ShellPlacement = "beforePageContent" | "afterPageContent";

// ── Trait System (replaces capability assist whitelist) ──────────────────

export interface LayoutTrait {
  /** e.g. "split", "centered", "editorial", "asymmetric", "stacked", "grid" */
  type: string;
  /** e.g. "60/40", "50/50", "70/30" — optional ratio hint */
  ratio?: string;
  /** e.g. "ltr", "rtl" — content direction bias */
  direction?: string;
  /** Free-form note for downstream code gen */
  note?: string;
}

export interface MotionTrait {
  /** "subtle" | "ambient" | "energetic" | "none" */
  intensity: string;
  /** e.g. "viewport-enter", "hover", "load", "scroll" */
  trigger?: string;
  /** Free-form note */
  note?: string;
}

export interface VisualTrait {
  /** e.g. "sparse", "dense", "balanced" */
  density?: string;
  /** e.g. "high", "low", "medium" */
  contrast?: string;
  /** e.g. "geometric", "organic", "typographic", "photographic" */
  style?: string;
  /** Free-form note */
  note?: string;
}

export interface InteractionTrait {
  /** e.g. "cta-focused", "explorative", "passive", "data-driven" */
  mode?: string;
  /** Free-form note */
  note?: string;
}

export interface SectionTraits {
  layout?: LayoutTrait;
  motion?: MotionTrait;
  visual?: VisualTrait;
  interaction?: InteractionTrait;
}
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
  journeyStageHints?: string[];
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
}

export interface SectionDesignPlan {
  role: string;
  goal: string;
  roleFit: string;
  taskLoopFocus: string;
  capabilityFocus: string;
  informationArchitecture: string;
  layoutIntent: string;
  visualIntent: string;
  interactionIntent: string;
  contentStrategy: string;
  hierarchy: string[];
  guardrailIds: GuardrailId[];
  traits: SectionTraits;
  constraints: string[];
  shellPlacement?: ShellPlacement;
  rationale?: string;
}

export interface PlannedSectionSpec extends SectionSpec {
  designPlan: SectionDesignPlan;
}

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
  audienceFocus: string;
  roleFit: string;
  capabilityFocus: string;
  taskLoopCoverage: string;
  narrativeArc: string;
  layoutStrategy: string;
  hierarchy: string[];
  transitionStrategy: string;
  sharedShellNotes: string[];
  constraints: string[];
  rationale?: string;
}

export interface PlannedPageBlueprint extends Omit<PageBlueprint, "sections"> {
  pageDesignPlan: PageDesignPlan;
  sections: PlannedSectionSpec[];
}

export interface ProjectBrief {
  projectTitle: string;
  projectDescription: string;
  language: string; // e.g. "zh-CN", "en", "ja" — detected from user input
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
  layoutSections: SectionSpec[];
  pages: PageBlueprint[];
}

export interface ProjectBlueprint {
  brief: ProjectBrief;
  experience: ProjectExperience;
  site: ProjectSiteBlueprint;
}

export interface PlannedProjectSiteBlueprint
  extends Omit<ProjectSiteBlueprint, "layoutSections" | "pages"> {
  layoutSections: PlannedSectionSpec[];
  pages: PlannedPageBlueprint[];
}

export interface PlannedProjectBlueprint
  extends Omit<ProjectBlueprint, "site"> {
  projectGuardrailIds: GuardrailId[];
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

export interface BuildStep {
  step: string;
  status: "ok" | "error" | "active";
  detail?: string;
  timestamp: number;
  duration: number;
  /** For generate_section steps: the component skill ID that was applied */
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
