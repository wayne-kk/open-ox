import { AsyncLocalStorage } from "node:async_hooks";
import type { PromptProfile } from "@/ai/prompts/core/profile";

export type CorePromptKind = "step" | "section";

export interface CorePromptDefinition {
  profile: PromptProfile;
  stepId: string;
  kind: CorePromptKind;
  promptId: string;
  label: string;
}

const CORE_STEP_PROMPTS: CorePromptDefinition[] = [
  {
    profile: "web",
    stepId: "analyze_project_requirement",
    kind: "step",
    promptId: "analyzeProjectRequirement",
    label: "需求分析",
  },
  { profile: "web", stepId: "infer_design_intent", kind: "step", promptId: "inferDesignIntent", label: "设计意图推断" },
  { profile: "web", stepId: "plan_project", kind: "step", promptId: "planProject", label: "项目规划" },
  {
    profile: "web",
    stepId: "generate_project_design_system",
    kind: "step",
    promptId: "generateProjectDesignSystem",
    label: "设计系统生成",
  },
  {
    profile: "web",
    stepId: "apply_project_design_tokens",
    kind: "step",
    promptId: "applyProjectDesignTokens",
    label: "设计 Token 生成",
  },
  {
    profile: "web",
    stepId: "describe_page_sections",
    kind: "step",
    promptId: "describePageSections",
    label: "页面分段设计描述",
  },
  {
    profile: "web",
    stepId: "generate_section_default",
    kind: "section",
    promptId: "section.default",
    label: "Section 默认 Prompt",
  },
  { profile: "web", stepId: "compose_layout", kind: "step", promptId: "composeLayout", label: "布局组合" },
  { profile: "web", stepId: "compose_page", kind: "step", promptId: "composePage", label: "页面组合" },
  { profile: "web", stepId: "dependency_resolver", kind: "step", promptId: "dependencyResolver", label: "依赖修复" },
  { profile: "web", stepId: "repair_build", kind: "step", promptId: "repairBuild", label: "构建修复" },
];

const stepIdToPromptId = new Map(
  CORE_STEP_PROMPTS.map((item) => [`${item.profile}:${item.stepId}`, item.promptId])
);
const stepIdToKind = new Map(
  CORE_STEP_PROMPTS.map((item) => [`${item.profile}:${item.stepId}`, item.kind])
);

interface CorePromptRuntimeConfig {
  promptProfile: PromptProfile;
  useDatabasePrompts: boolean;
  dbPromptByStepId: Map<string, string>;
}

const corePromptRuntimeStorage = new AsyncLocalStorage<CorePromptRuntimeConfig>();

export async function withCorePromptRuntime<T>(
  config: CorePromptRuntimeConfig,
  runner: () => Promise<T>
): Promise<T> {
  return corePromptRuntimeStorage.run(config, runner);
}

/** Web-only generation; legacy `"app"` values are coerced to `"web"`. */
export function normalizePromptProfile(profile: unknown): PromptProfile {
  void profile;
  return "web";
}

export function getCoreStepPrompts(profile: PromptProfile): CorePromptDefinition[] {
  void profile;
  return CORE_STEP_PROMPTS;
}

export function getCoreStepPromptOverride(params: {
  profile?: PromptProfile;
  kind: CorePromptKind;
  promptId: string;
}): string | null {
  void params;
  return null;
}

export function resolvePromptIdByStepId(profile: PromptProfile, stepId: string): string | null {
  return stepIdToPromptId.get(`${profile}:${stepId}`) ?? null;
}

export function resolvePromptKindByStepId(profile: PromptProfile, stepId: string): CorePromptKind | null {
  return stepIdToKind.get(`${profile}:${stepId}`) ?? null;
}

export async function loadCoreStepPromptsFromDB(profile: PromptProfile = "web"): Promise<Map<string, string>> {
  void profile;
  return new Map<string, string>();
}

export function getPromptOverrideByStepId(
  overridesByStepId: Map<string, string>,
  stepId: string
): string | null {
  return overridesByStepId.get(stepId) ?? null;
}
