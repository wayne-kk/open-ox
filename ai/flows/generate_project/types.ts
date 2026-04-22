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

/** PlannedSectionSpec is now identical to SectionSpec — kept as alias for downstream compat. */
export type PlannedSectionSpec = SectionSpec;

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

export interface AppScreenRegionPlan {
  id: string;
  title: string;
  intent: string;
  contentHints: string;
  priority: "primary" | "secondary" | "supporting";
}

export interface AppScreenInteractionModel {
  navigationStyle: string;
  primaryActionModel: string;
  feedbackPattern: string;
}

export interface AppScreenPlan {
  screenType: string;
  shellStyle: string;
  narrative: string;
  regions: AppScreenRegionPlan[];
  interactionModel: AppScreenInteractionModel;
  preferredSkillIds?: string[];
}

export interface PlannedPageBlueprint extends Omit<PageBlueprint, "sections"> {
  pageDesignPlan: PageDesignPlan;
  sections: PlannedSectionSpec[];
  appScreenPlan?: AppScreenPlan;
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
