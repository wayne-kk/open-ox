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
export type CapabilityAssistId = string;
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
  capabilityAssistIds: CapabilityAssistId[];
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

export interface BuildStep {
  step: string;
  status: "ok" | "error";
  detail?: string;
  timestamp: number;
  duration: number;
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
