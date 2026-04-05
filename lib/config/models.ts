// lib/config/models.ts

export interface ModelConfig {
    id: string;
    displayName: string;
    contextWindow: number;
}

// Built-in models — always available
const BUILTIN_MODELS: ModelConfig[] = [
    { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", contextWindow: 128_000 },
    { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", contextWindow: 128_000 },
    { id: "gpt-5.2", displayName: "GPT-5.2", contextWindow: 128_000 },
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

export function setStepModel(stepName: string, modelId: ModelId): void {
    _stepModelMap.set(stepName, modelId);
}

export function clearStepModels(): void {
    _stepModelMap.clear();
}

export function getStepModel(stepName: string): ModelId | null {
    return _stepModelMap.get(stepName) ?? null;
}

export function getModelForStep(stepName: string): ModelId {
    return getStepModel(stepName) ?? getModelId();
}

/** Available generation steps that can have model overrides */
export const GENERATION_STEPS = [
    { id: "analyze_project_requirement", label: "需求分析" },
    { id: "plan_project", label: "项目规划" },
    { id: "generate_project_design_system", label: "设计系统" },
    { id: "apply_project_design_tokens", label: "设计 Token" },
    { id: "preselect_skills", label: "技能匹配" },
    { id: "generate_section", label: "组件生成" },
    { id: "compose_page", label: "页面组合" },
    { id: "repair_build", label: "构建修复" },
] as const;
