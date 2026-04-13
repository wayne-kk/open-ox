// lib/config/models.ts

export interface ModelConfig {
    id: string;
    displayName: string;
    contextWindow: number;
    supportsThinking?: boolean;
}

// Built-in models — always available
const BUILTIN_MODELS: ModelConfig[] = [
    { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", contextWindow: 128_000, supportsThinking: false },
    { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", contextWindow: 128_000, supportsThinking: false },
    { id: "gpt-5.2", displayName: "GPT-5.2", contextWindow: 128_000, supportsThinking: false },
];

// User-added models (loaded from DB at runtime)
let _customModels: ModelConfig[] = [];

export function setCustomModels(models: ModelConfig[]): void {
    _customModels = models;
}

export function getAllModels(): ModelConfig[] {
    return [...BUILTIN_MODELS, ..._customModels];
}

export type ModelId = string;
export const DEFAULT_MODEL: ModelId = "gemini-3-flash-preview";

/** Values accepted by upstream for `thinking_level` on chat/completions */
export const STEP_THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;
export type StepThinkingLevel = (typeof STEP_THINKING_LEVELS)[number];

export function isStepThinkingLevel(v: string): v is StepThinkingLevel {
    return (STEP_THINKING_LEVELS as readonly string[]).includes(v);
}

/** Runtime override — set by API route per-request */
let _runtimeModelId: ModelId | null = null;

export function setRuntimeModelId(id: ModelId | null): void {
    _runtimeModelId = id;
}

export function getModelId(): ModelId {
    if (_runtimeModelId) return _runtimeModelId;
    return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/** Model used by the modify agent when no runtime override is set */
export const MODIFY_DEFAULT_MODEL: ModelId = "claude-opus-4-6";

export function getModifyModelId(): ModelId {
    if (_runtimeModelId) return _runtimeModelId;
    return process.env.MODIFY_MODEL || MODIFY_DEFAULT_MODEL;
}

/** Step-level model overrides */
const _stepModelMap = new Map<string, ModelId>();
const _stepThinkingLevelMap = new Map<string, StepThinkingLevel>();

export function setStepModel(stepName: string, modelId: ModelId): void {
    _stepModelMap.set(stepName, modelId);
}

export function setStepThinkingLevel(stepName: string, level: StepThinkingLevel | null): void {
    if (level == null) {
        _stepThinkingLevelMap.delete(stepName);
    } else {
        _stepThinkingLevelMap.set(stepName, level);
    }
}

export function clearStepModels(): void {
    _stepModelMap.clear();
    _stepThinkingLevelMap.clear();
}

export function getStepModel(stepName: string): ModelId | null {
    return _stepModelMap.get(stepName) ?? null;
}

export function getModelForStep(stepName: string): ModelId {
    return getStepModel(stepName) ?? getModelId();
}

export function getThinkingLevelForStep(stepName: string): StepThinkingLevel | undefined {
    return _stepThinkingLevelMap.get(stepName);
}

export function clearStepConfig(stepName: string): void {
    _stepModelMap.delete(stepName);
    _stepThinkingLevelMap.delete(stepName);
}

// ── Section Skills toggle ───────────────────────────────────────────────

let _sectionSkillsEnabled = false;

export function setSectionSkillsEnabled(enabled: boolean): void {
    _sectionSkillsEnabled = enabled;
}

export function isSectionSkillsEnabled(): boolean {
    return _sectionSkillsEnabled;
}

/** Available generation steps that can have model overrides */
export const GENERATION_STEPS = [
    { id: "analyze_project_requirement", label: "需求分析" },
    { id: "plan_project", label: "项目规划" },
    { id: "generate_project_design_system", label: "设计系统" },
    { id: "apply_project_design_tokens", label: "设计 Token" },
    { id: "preselect_skills", label: "技能匹配" },
    { id: "generate_screen", label: "整屏生成" },
    { id: "generate_section", label: "组件生成" },
    { id: "compose_page", label: "页面组合" },
    { id: "repair_build", label: "构建修复" },
] as const;

/** Check if a model supports thinking/reasoning mode */
export function modelSupportsThinking(modelId: string): boolean {
    const all = getAllModels();
    const model = all.find((m) => m.id === modelId);
    return model?.supportsThinking ?? false;
}

/**
 * Load step-level model overrides from Supabase into memory.
 * Call this before any generation flow to ensure DB settings are applied
 * even after process restarts or serverless cold starts.
 */
export async function loadStepModelsFromDB(): Promise<void> {
    try {
        const { supabase } = await import("@/lib/supabase");
        const { data: rows, error } = await supabase
            .from("step_model_configs")
            .select("step_name, model_id, thinking_level");

        // Backward compatibility: if DB hasn't run the thinking_level migration yet,
        // fall back to loading step->model mapping so generate_section override still works.
        if (error) {
            const needsFallback = error.message?.toLowerCase().includes("thinking_level");
            if (!needsFallback) throw error;
            const { data: legacyRows, error: legacyError } = await supabase
                .from("step_model_configs")
                .select("step_name, model_id");
            if (legacyError) throw legacyError;
            clearStepModels();
            for (const row of legacyRows ?? []) {
                const { step_name, model_id } = row as { step_name: string; model_id: string };
                _stepModelMap.set(step_name, model_id);
            }
            return;
        }

        clearStepModels();
        if (rows) {
            for (const row of rows) {
                const { step_name, model_id, thinking_level } = row as {
                    step_name: string;
                    model_id: string;
                    thinking_level?: string | null;
                };
                _stepModelMap.set(step_name, model_id);
                if (thinking_level && isStepThinkingLevel(thinking_level)) {
                    _stepThinkingLevelMap.set(step_name, thinking_level);
                }
            }
        }
    } catch (err) {
        console.warn("[loadStepModelsFromDB] Failed to load step models:", err);
    }
}
