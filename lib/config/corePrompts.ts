import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type CorePromptKind = "step" | "section";

export interface CorePromptDefinition {
  stepId: string;
  kind: CorePromptKind;
  promptId: string;
  label: string;
}

export const CORE_STEP_PROMPTS: CorePromptDefinition[] = [
  { stepId: "analyze_project_requirement", kind: "step", promptId: "analyzeProjectRequirement", label: "需求分析" },
  { stepId: "infer_design_intent", kind: "step", promptId: "inferDesignIntent", label: "设计意图推断" },
  { stepId: "plan_project", kind: "step", promptId: "planProject", label: "项目规划" },
  { stepId: "generate_project_design_system", kind: "step", promptId: "generateProjectDesignSystem", label: "设计系统生成" },
  { stepId: "apply_project_design_tokens", kind: "step", promptId: "applyProjectDesignTokens", label: "设计 Token 生成" },
  { stepId: "generate_section_default", kind: "section", promptId: "section.default", label: "Section 默认 Prompt" },
  { stepId: "compose_layout", kind: "step", promptId: "composeLayout", label: "布局组合" },
  { stepId: "compose_page", kind: "step", promptId: "composePage", label: "页面组合" },
  { stepId: "repair_build", kind: "step", promptId: "repairBuild", label: "构建修复" },
];

const promptKeyToStepId = new Map(
  CORE_STEP_PROMPTS.map((item) => [`${item.kind}:${item.promptId}`, item.stepId])
);
const stepIdToPromptId = new Map(CORE_STEP_PROMPTS.map((item) => [item.stepId, item.promptId]));
const stepIdToKind = new Map(CORE_STEP_PROMPTS.map((item) => [item.stepId, item.kind]));

interface CorePromptRuntimeConfig {
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
      dbPromptByStepId: new Map<string, string>(),
    }
  );
}

export function getCoreStepPromptOverride(params: {
  kind: CorePromptKind;
  promptId: string;
}): string | null {
  const runtime = getCorePromptRuntime();
  if (!runtime.useDatabasePrompts) return null;
  const stepId = promptKeyToStepId.get(`${params.kind}:${params.promptId}`);
  if (!stepId) return null;
  return runtime.dbPromptByStepId.get(stepId) ?? null;
}

export function isCoreStepPromptId(promptId: string): boolean {
  return promptKeyToStepId.has(`step:${promptId}`) || promptKeyToStepId.has(`section:${promptId}`);
}

export function resolvePromptIdByStepId(stepId: string): string | null {
  return stepIdToPromptId.get(stepId) ?? null;
}

export function resolvePromptKindByStepId(stepId: string): CorePromptKind | null {
  return stepIdToKind.get(stepId) ?? null;
}

export async function loadCoreStepPromptsFromDB(): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  try {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from("core_step_prompt_configs")
      .select("step_id,prompt_content");
    if (error) throw error;

    for (const row of data ?? []) {
      const stepId = (row as { step_id: string }).step_id;
      const promptContent = (row as { prompt_content: string }).prompt_content;
      if (stepIdToPromptId.has(stepId) && typeof promptContent === "string" && promptContent.trim()) {
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
