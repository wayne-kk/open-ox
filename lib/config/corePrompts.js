import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
export const CORE_STEP_PROMPTS = [
    { stepId: "analyze_project_requirement", kind: "step", promptId: "analyzeProjectRequirement", label: "需求分析" },
    { stepId: "infer_design_intent", kind: "step", promptId: "inferDesignIntent", label: "设计意图推断" },
    { stepId: "plan_project", kind: "step", promptId: "planProject", label: "项目规划" },
    { stepId: "generate_project_design_system", kind: "step", promptId: "generateProjectDesignSystem", label: "设计系统生成" },
    { stepId: "apply_project_design_tokens", kind: "step", promptId: "applyProjectDesignTokens", label: "设计 Token 生成" },
    { stepId: "describe_page_sections", kind: "step", promptId: "describePageSections", label: "页面分段设计描述" },
    { stepId: "generate_section_default", kind: "section", promptId: "section.default", label: "Section 默认 Prompt" },
    { stepId: "compose_layout", kind: "step", promptId: "composeLayout", label: "布局组合" },
    { stepId: "compose_page", kind: "step", promptId: "composePage", label: "页面组合" },
    { stepId: "repair_build", kind: "step", promptId: "repairBuild", label: "构建修复" },
];
const promptKeyToStepId = new Map(CORE_STEP_PROMPTS.map((item) => [`${item.kind}:${item.promptId}`, item.stepId]));
const stepIdToPromptId = new Map(CORE_STEP_PROMPTS.map((item) => [item.stepId, item.promptId]));
const stepIdToKind = new Map(CORE_STEP_PROMPTS.map((item) => [item.stepId, item.kind]));
const corePromptRuntimeStorage = new AsyncLocalStorage();
export async function withCorePromptRuntime(config, runner) {
    return corePromptRuntimeStorage.run(config, runner);
}
function getCorePromptRuntime() {
    return (corePromptRuntimeStorage.getStore() ?? {
        useDatabasePrompts: true,
        dbPromptByStepId: new Map(),
    });
}
export function getCoreStepPromptOverride(params) {
    const runtime = getCorePromptRuntime();
    if (!runtime.useDatabasePrompts)
        return null;
    const stepId = promptKeyToStepId.get(`${params.kind}:${params.promptId}`);
    if (!stepId)
        return null;
    return runtime.dbPromptByStepId.get(stepId) ?? null;
}
export function isCoreStepPromptId(promptId) {
    return promptKeyToStepId.has(`step:${promptId}`) || promptKeyToStepId.has(`section:${promptId}`);
}
export function resolvePromptIdByStepId(stepId) {
    return stepIdToPromptId.get(stepId) ?? null;
}
export function resolvePromptKindByStepId(stepId) {
    return stepIdToKind.get(stepId) ?? null;
}
export async function loadCoreStepPromptsFromDB() {
    const overrides = new Map();
    try {
        const service = createSupabaseServiceRoleClient();
        const { data, error } = await service
            .from("core_step_prompt_configs")
            .select("step_id,prompt_content");
        if (error)
            throw error;
        for (const row of data ?? []) {
            const stepId = row.step_id;
            const promptContent = row.prompt_content;
            if (stepIdToPromptId.has(stepId) && typeof promptContent === "string" && promptContent.trim()) {
                overrides.set(stepId, promptContent);
            }
        }
    }
    catch (error) {
        console.warn("[corePrompts] Failed to load DB prompt overrides:", error);
    }
    return overrides;
}
export function getPromptOverrideByStepId(overridesByStepId, stepId) {
    return overridesByStepId.get(stepId) ?? null;
}
//# sourceMappingURL=corePrompts.js.map