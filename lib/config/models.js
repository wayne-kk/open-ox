// lib/config/models.ts
// Built-in models — always available
const BUILTIN_MODELS = [
    { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", contextWindow: 128000, supportsThinking: false },
    { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", contextWindow: 128000, supportsThinking: false },
    { id: "gpt-5.2", displayName: "GPT-5.2", contextWindow: 128000, supportsThinking: false },
];
// User-added models (loaded from DB at runtime)
let _customModels = [];
export function setCustomModels(models) {
    _customModels = models;
}
export function getAllModels() {
    return [...BUILTIN_MODELS, ..._customModels];
}
export const DEFAULT_MODEL = "gemini-3-flash-preview";
/** Values accepted by upstream for `thinking_level` on chat/completions */
export const STEP_THINKING_LEVELS = ["minimal", "low", "medium", "high"];
export function isStepThinkingLevel(v) {
    return STEP_THINKING_LEVELS.includes(v);
}
/** Runtime override — set by API route per-request */
let _runtimeModelId = null;
export function setRuntimeModelId(id) {
    _runtimeModelId = id;
}
export function getModelId() {
    if (_runtimeModelId)
        return _runtimeModelId;
    return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}
/** Model used by the modify agent when no runtime override is set */
export const MODIFY_DEFAULT_MODEL = "gemini-3-flash-preview";
/** Heavier model for broad modify (plan + multi-file) — override via MODIFY_COMPLEX_MODEL env */
export const MODIFY_COMPLEX_MODEL =
    (process.env.MODIFY_COMPLEX_MODEL?.trim()) || "gemini-3.1-pro-preview";
export function getModifyModelId() {
    if (_runtimeModelId)
        return _runtimeModelId;
    return process.env.MODIFY_MODEL || MODIFY_DEFAULT_MODEL;
}
/** Step-level model overrides */
const _stepModelMap = new Map();
const _stepThinkingLevelMap = new Map();
const STEP_MODELS_CACHE_TTL_MS = 60_000;
let _stepModelsLoadedAt = 0;
let _stepModelsLoadPromise = null;
export function setStepModel(stepName, modelId) {
    _stepModelMap.set(stepName, modelId);
}
export function setStepThinkingLevel(stepName, level) {
    if (level == null) {
        _stepThinkingLevelMap.delete(stepName);
    }
    else {
        _stepThinkingLevelMap.set(stepName, level);
    }
}
export function clearStepModels() {
    _stepModelMap.clear();
    _stepThinkingLevelMap.clear();
    _stepModelsLoadedAt = 0;
}
export function getStepModel(stepName) {
    return _stepModelMap.get(stepName) ?? null;
}
export function getModelForStep(stepName) {
    return getStepModel(stepName) ?? getModelId();
}
export function getThinkingLevelForStep(stepName) {
    return _stepThinkingLevelMap.get(stepName);
}
export function clearStepConfig(stepName) {
    _stepModelMap.delete(stepName);
    _stepThinkingLevelMap.delete(stepName);
}
/** Available generation steps that can have model overrides */
export const GENERATION_STEPS = [
    { id: "intent_agent", label: "建站意向 Task Agent" },
    { id: "modify_intent_router", label: "修改入口意图分类" },
    { id: "modify_plan", label: "修改·广域变更规划" },
    { id: "analyze_project_requirement", label: "需求分析" },
    { id: "infer_design_intent", label: "设计意图推断" },
    { id: "plan_project", label: "项目规划" },
    { id: "generate_project_design_system", label: "设计系统" },
    { id: "apply_project_design_tokens", label: "设计 Token" },
    { id: "preselect_skills", label: "技能匹配" },
    { id: "architect_scaffold_agent", label: "Chrome Scaffold（先落真实壳）" },
    { id: "chrome_optimize_agent", label: "Chrome Polish（链接精修）" },
    { id: "page_implement_agent", label: "页面实现 Agent" },
    { id: "repair_build", label: "构建修复" },
];
/** Check if a model supports thinking/reasoning mode */
export function modelSupportsThinking(modelId) {
    const all = getAllModels();
    const model = all.find((m) => m.id === modelId);
    return model?.supportsThinking ?? false;
}
/**
 * Load step-level model overrides from Supabase into memory.
 * Call this before any generation flow to ensure DB settings are applied
 * even after process restarts or serverless cold starts.
 *
 * In-process TTL cache avoids a Supabase round-trip on every intent turn /
 * generation enqueue (common on Studio chat).
 */
export async function loadStepModelsFromDB() {
    const now = Date.now();
    if (_stepModelsLoadedAt > 0 && now - _stepModelsLoadedAt < STEP_MODELS_CACHE_TTL_MS) {
        return;
    }
    if (_stepModelsLoadPromise) {
        await _stepModelsLoadPromise;
        return;
    }
    _stepModelsLoadPromise = (async () => {
        try {
            const { supabase } = await import("@/lib/supabase");
            const { data: rows, error } = await supabase
                .from("step_model_configs")
                .select("step_name, model_id, thinking_level");
            // Backward compatibility: if DB hasn't run the thinking_level migration yet,
            // fall back to loading step->model mapping only.
            if (error) {
                const needsFallback = error.message?.toLowerCase().includes("thinking_level");
                if (!needsFallback)
                    throw error;
                const { data: legacyRows, error: legacyError } = await supabase
                    .from("step_model_configs")
                    .select("step_name, model_id");
                if (legacyError)
                    throw legacyError;
                clearStepModels();
                for (const row of legacyRows ?? []) {
                    const { step_name, model_id } = row;
                    _stepModelMap.set(step_name, model_id);
                }
                _stepModelsLoadedAt = Date.now();
                return;
            }
            clearStepModels();
            if (rows) {
                for (const row of rows) {
                    const { step_name, model_id, thinking_level } = row;
                    _stepModelMap.set(step_name, model_id);
                    if (thinking_level && isStepThinkingLevel(thinking_level)) {
                        _stepThinkingLevelMap.set(step_name, thinking_level);
                    }
                }
            }
            _stepModelsLoadedAt = Date.now();
        }
        catch (err) {
            console.warn("[loadStepModelsFromDB] Failed to load step models:", err);
        }
        finally {
            _stepModelsLoadPromise = null;
        }
    })();
    await _stepModelsLoadPromise;
}
//# sourceMappingURL=models.js.map
