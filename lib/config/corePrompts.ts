import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { PromptProfile } from "@/ai/prompts/core/profile";

export type CorePromptKind = "step" | "section";

export interface CorePromptDefinition {
  profile: PromptProfile;
  stepId: string;
  kind: CorePromptKind;
  promptId: string;
  label: string;
}

const WEB_CORE_STEP_PROMPTS: CorePromptDefinition[] = [
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

const APP_CORE_STEP_PROMPTS: CorePromptDefinition[] = [
  {
    profile: "app",
    stepId: "analyze_project_requirement",
    kind: "step",
    promptId: "analyzeProjectRequirement",
    label: "需求分析",
  },
  { profile: "app", stepId: "infer_design_intent", kind: "step", promptId: "inferDesignIntent", label: "设计意图推断" },
  { profile: "app", stepId: "plan_project", kind: "step", promptId: "planProject", label: "项目规划" },
  {
    profile: "app",
    stepId: "generate_project_design_system",
    kind: "step",
    promptId: "generateProjectDesignSystem",
    label: "设计系统生成",
  },
  {
    profile: "app",
    stepId: "apply_project_design_tokens",
    kind: "step",
    promptId: "applyProjectDesignTokens",
    label: "设计 Token 生成",
  },
  { profile: "app", stepId: "compose_layout", kind: "step", promptId: "composeLayout", label: "布局组合" },
  { profile: "app", stepId: "generate_screen", kind: "step", promptId: "generateScreen", label: "Screen 生成" },
  { profile: "app", stepId: "compose_page", kind: "step", promptId: "composePage", label: "页面组合" },
  { profile: "app", stepId: "dependency_resolver", kind: "step", promptId: "dependencyResolver", label: "依赖修复" },
  { profile: "app", stepId: "repair_build", kind: "step", promptId: "repairBuild", label: "构建修复" },
];

const CORE_STEP_PROMPTS_BY_PROFILE: Record<PromptProfile, CorePromptDefinition[]> = {
  web: WEB_CORE_STEP_PROMPTS,
  app: APP_CORE_STEP_PROMPTS,
};

const promptKeyToStepId = new Map(
  Object.values(CORE_STEP_PROMPTS_BY_PROFILE)
    .flat()
    .map((item) => [`${item.profile}:${item.kind}:${item.promptId}`, item.stepId])
);
const stepIdToPromptId = new Map(
  Object.values(CORE_STEP_PROMPTS_BY_PROFILE)
    .flat()
    .map((item) => [`${item.profile}:${item.stepId}`, item.promptId])
);
const stepIdToKind = new Map(
  Object.values(CORE_STEP_PROMPTS_BY_PROFILE)
    .flat()
    .map((item) => [`${item.profile}:${item.stepId}`, item.kind])
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

function getCorePromptRuntime(): CorePromptRuntimeConfig {
  return (
    corePromptRuntimeStorage.getStore() ?? {
      useDatabasePrompts: true,
      promptProfile: "web",
      dbPromptByStepId: new Map<string, string>(),
    }
  );
}

export function normalizePromptProfile(profile: unknown): PromptProfile {
  return profile === "app" ? "app" : "web";
}

export function getCoreStepPrompts(profile: PromptProfile): CorePromptDefinition[] {
  return CORE_STEP_PROMPTS_BY_PROFILE[profile];
}

export function getCoreStepPromptOverride(params: {
  profile?: PromptProfile;
  kind: CorePromptKind;
  promptId: string;
}): string | null {
  const runtime = getCorePromptRuntime();
  if (!runtime.useDatabasePrompts) return null;
  const profile = params.profile ?? runtime.promptProfile;
  const stepId = promptKeyToStepId.get(`${profile}:${params.kind}:${params.promptId}`);
  if (!stepId) return null;
  return runtime.dbPromptByStepId.get(stepId) ?? null;
}

export function isCoreStepPromptId(promptId: string): boolean {
  return (
    promptKeyToStepId.has(`web:step:${promptId}`) ||
    promptKeyToStepId.has(`web:section:${promptId}`) ||
    promptKeyToStepId.has(`app:step:${promptId}`) ||
    promptKeyToStepId.has(`app:section:${promptId}`)
  );
}

export function resolvePromptIdByStepId(profile: PromptProfile, stepId: string): string | null {
  return stepIdToPromptId.get(`${profile}:${stepId}`) ?? null;
}

export function resolvePromptKindByStepId(profile: PromptProfile, stepId: string): CorePromptKind | null {
  return stepIdToKind.get(`${profile}:${stepId}`) ?? null;
}

export async function loadCoreStepPromptsFromDB(profile: PromptProfile = "web"): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  try {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from("core_step_prompt_configs")
      .select("step_id,prompt_content")
      .eq("prompt_profile", profile);
    if (error) throw error;

    for (const row of data ?? []) {
      const stepId = (row as { step_id: string }).step_id;
      const promptContent = (row as { prompt_content: string }).prompt_content;
      if (
        stepIdToPromptId.has(`${profile}:${stepId}`) &&
        typeof promptContent === "string" &&
        promptContent.trim()
      ) {
        overrides.set(stepId, promptContent);
      }
    }
  } catch (error) {
    console.warn("[corePrompts] Failed to load DB prompt overrides:", error);
  }
  return overrides;
}

export function getPromptOverrideByStepId(
  overridesByStepId: Map<string, string>,
  stepId: string
): string | null {
  return overridesByStepId.get(stepId) ?? null;
}
