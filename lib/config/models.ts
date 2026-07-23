// lib/config/models.ts

import { AsyncLocalStorage } from "node:async_hooks";

export interface ModelConfig {
    id: string;
    displayName: string;
    contextWindow: number;
    supportsThinking?: boolean;
    tokenPrice?: ModelTokenPrice;
}

export type ModelTokenPrice = {
    /** Public model cost in USD per one million input tokens. */
    inputPerMTok: number;
    /** Public model cost in USD per one million output tokens. */
    outputPerMTok: number;
};

/** Configurable fallback for unregistered model IDs. */
export const DEFAULT_MODEL_TOKEN_PRICE: ModelTokenPrice = {
    inputPerMTok: 0.5,
    outputPerMTok: 3,
};

export type ModelConfigRow = {
    id: string;
    display_name: string;
    context_window: number;
    supports_thinking?: boolean;
    input_price_per_mtok?: number | string | null;
    output_price_per_mtok?: number | string | null;
};

export function modelConfigFromRow(row: ModelConfigRow): ModelConfig {
    return {
        id: row.id,
        displayName: row.display_name,
        contextWindow: row.context_window,
        supportsThinking: row.supports_thinking ?? false,
        tokenPrice: tokenPriceFromRow(row),
    };
}

function optionalNonNegativeNumber(value: number | string | null | undefined): number | undefined {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function tokenPriceFromRow(row: ModelConfigRow): ModelTokenPrice | undefined {
    const inputPerMTok = optionalNonNegativeNumber(row.input_price_per_mtok);
    const outputPerMTok = optionalNonNegativeNumber(row.output_price_per_mtok);
    return inputPerMTok != null && outputPerMTok != null
        ? { inputPerMTok, outputPerMTok }
        : undefined;
}

// Built-in models — always available
const BUILTIN_MODELS: ModelConfig[] = [
    { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", contextWindow: 128_000, supportsThinking: false, tokenPrice: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
    { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", contextWindow: 128_000, supportsThinking: false, tokenPrice: { inputPerMTok: 1.25, outputPerMTok: 5 } },
];

// User-added models (loaded from DB at runtime)
let _customModels: ModelConfig[] = [];

export function setCustomModels(models: ModelConfig[]): void {
    _customModels = models;
}

export function upsertCustomModel(model: ModelConfig): void {
    _customModels = [..._customModels.filter((existing) => existing.id !== model.id), model];
}

export function getAllModels(): ModelConfig[] {
    const modelsById = new Map(BUILTIN_MODELS.map((model) => [model.id, model]));
    for (const model of _customModels) modelsById.set(model.id, model);
    return [...modelsById.values()];
}

export function getBuiltInModels(): ModelConfig[] {
    return [...BUILTIN_MODELS];
}

export type ModelId = string;
export const DEFAULT_MODEL: ModelId = "gemini-3-flash-preview";

/** Values accepted by upstream for `thinking_level` on chat/completions */
export const STEP_THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;
export type StepThinkingLevel = (typeof STEP_THINKING_LEVELS)[number];

export function isStepThinkingLevel(v: string): v is StepThinkingLevel {
    return (STEP_THINKING_LEVELS as readonly string[]).includes(v);
}

type RuntimeModelContext = {
    modelId: ModelId | null;
    stepModels: Map<string, ModelId>;
    stepThinkingLevels: Map<string, StepThinkingLevel>;
};

const _runtimeModelContext = new AsyncLocalStorage<RuntimeModelContext>();

export function beginModelRuntimeContext(): void {
    _runtimeModelContext.enterWith({
        modelId: null,
        stepModels: new Map(),
        stepThinkingLevels: new Map(),
    });
}

function getOrCreateRuntimeContext(): RuntimeModelContext {
    const current = _runtimeModelContext.getStore();
    if (current) return current;

    const context: RuntimeModelContext = {
        modelId: null,
        stepModels: new Map(),
        stepThinkingLevels: new Map(),
    };
    _runtimeModelContext.enterWith(context);
    return context;
}

/** Runtime override — isolated to the current async request/run. */

export function setRuntimeModelId(id: ModelId | null): void {
    getOrCreateRuntimeContext().modelId = id;
}

export function getModelId(): ModelId {
    const runtimeModelId = _runtimeModelContext.getStore()?.modelId;
    if (runtimeModelId) return runtimeModelId;
    return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/** Model used by the modify agent when no runtime override is set */
export const MODIFY_DEFAULT_MODEL: ModelId = "gemini-3-flash-preview";

/** Heavier model for broad modify (plan + multi-file) — override via MODIFY_COMPLEX_MODEL env */
export const MODIFY_COMPLEX_MODEL: ModelId =
  (process.env.MODIFY_COMPLEX_MODEL?.trim() as ModelId) || "gemini-3.1-pro-preview";

export function getModifyModelId(): ModelId {
    const runtimeModelId = _runtimeModelContext.getStore()?.modelId;
    if (runtimeModelId) return runtimeModelId;
    return process.env.MODIFY_MODEL || MODIFY_DEFAULT_MODEL;
}

/** Step-level model overrides */
const _configuredStepModelMap = new Map<string, ModelId>();
const _configuredStepThinkingLevelMap = new Map<string, StepThinkingLevel>();

export function setStepModel(stepName: string, modelId: ModelId): void {
    getOrCreateRuntimeContext().stepModels.set(stepName, modelId);
}

export function setConfiguredStepModel(stepName: string, modelId: ModelId): void {
    _configuredStepModelMap.set(stepName, modelId);
}

export function isStepModelConfigured(stepName: string): boolean {
    return _configuredStepModelMap.has(stepName);
}

export function setStepThinkingLevel(stepName: string, level: StepThinkingLevel | null): void {
    const levels = getOrCreateRuntimeContext().stepThinkingLevels;
    if (level == null) {
        levels.delete(stepName);
    } else {
        levels.set(stepName, level);
    }
}

export function setConfiguredStepThinkingLevel(
    stepName: string,
    level: StepThinkingLevel | null
): void {
    if (level == null) {
        _configuredStepThinkingLevelMap.delete(stepName);
    } else {
        _configuredStepThinkingLevelMap.set(stepName, level);
    }
}

export function clearStepModels(): void {
    const current = _runtimeModelContext.getStore();
    if (current) {
        current.modelId = null;
        current.stepModels.clear();
        current.stepThinkingLevels.clear();
    }
    beginModelRuntimeContext();
    _configuredStepModelMap.clear();
    _configuredStepThinkingLevelMap.clear();
    _stepModelsLoadedAt = 0;
}

export function getStepModel(stepName: string): ModelId | null {
    return _runtimeModelContext.getStore()?.stepModels.get(stepName)
        ?? _configuredStepModelMap.get(stepName)
        ?? null;
}

export function getModelForStep(stepName: string): ModelId {
    return getStepModel(stepName) ?? getModelId();
}

export function getThinkingLevelForStep(stepName: string): StepThinkingLevel | undefined {
    return _runtimeModelContext.getStore()?.stepThinkingLevels.get(stepName)
        ?? _configuredStepThinkingLevelMap.get(stepName);
}

export function clearStepConfig(stepName: string): void {
    _runtimeModelContext.getStore()?.stepModels.delete(stepName);
    _runtimeModelContext.getStore()?.stepThinkingLevels.delete(stepName);
    _configuredStepModelMap.delete(stepName);
    _configuredStepThinkingLevelMap.delete(stepName);
}

export function removeModelConfig(modelId: ModelId): void {
    _customModels = _customModels.filter((model) => model.id !== modelId);
    const runtime = _runtimeModelContext.getStore();
    for (const [stepName, configuredModelId] of _configuredStepModelMap) {
        if (configuredModelId !== modelId) continue;
        _configuredStepModelMap.delete(stepName);
        _configuredStepThinkingLevelMap.delete(stepName);
    }
    if (runtime) {
        for (const [stepName, runtimeModelId] of runtime.stepModels) {
            if (runtimeModelId !== modelId) continue;
            runtime.stepModels.delete(stepName);
            runtime.stepThinkingLevels.delete(stepName);
        }
    }
    _stepModelsLoadedAt = 0;
}

/** Available generation steps that can have model overrides */
export const GENERATION_STEPS = [
    { id: "intent_agent", label: "建站意向 Task Agent" },
    { id: "intent_brand_kit", label: "意向阶段·品牌体检（多模态）" },
    { id: "intent_ia_proposal", label: "意向阶段·单页 IA 提案" },
    { id: "intent_a11y_seo", label: "意向阶段·无障碍与 SEO 清单" },
    { id: "intent_competitive", label: "意向阶段·竞品速写" },
    { id: "reference_site_digest", label: "参考站截图+多模态摘要" },
    { id: "project_intent_guide", label: "建站意向引导" },
    { id: "modify_intent_router", label: "修改入口意图分类" },
    { id: "modify_board_planner", label: "修改·任务板拆解" },
    { id: "modify_plan", label: "修改·广域变更规划" },
    { id: "modify_agent", label: "修改·主 Agent" },
    { id: "modify_summary", label: "修改·完成总结" },
    { id: "commit_merged_brief_classifier", label: "确认生成·需求文本实质性（LLM）" },
    { id: "generate_vibe_directions", label: "气质方向三选一（LLM）" },
    { id: "analyze_project_requirement", label: "需求分析" },
    { id: "infer_design_intent", label: "设计意图推断" },
    { id: "plan_project", label: "项目规划" },
    { id: "match_design_system_skill", label: "设计系统 Skill 匹配" },
    { id: "generate_project_design_system", label: "设计系统" },
    { id: "apply_project_design_tokens", label: "设计 Token" },
    { id: "preselect_skills", label: "技能匹配" },
    { id: "architect_scaffold_agent", label: "Chrome Scaffold（chrome-first 真壳）" },
    { id: "chrome_optimize_agent", label: "Chrome polish（链接校正）" },
    { id: "analyze_screenshot_layout", label: "截图版式分析（ui-analyzer）" },
    { id: "section_replica_agent", label: "区块复刻 Agent（ui-replica）" },
    { id: "page_implement_agent", label: "页面实现 Agent" },
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
 *
 * In-process TTL cache avoids a Supabase round-trip on every intent turn /
 * generation enqueue (common on Studio chat).
 */
const STEP_MODELS_CACHE_TTL_MS = 60_000;
let _stepModelsLoadedAt = 0;
let _stepModelsLoadPromise: Promise<void> | null = null;

export async function loadStepModelsFromDB(): Promise<void> {
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
            const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/service-role");
            const database = createSupabaseServiceRoleClient();
            const { data: customRows, error: customModelsError } = await database
                .from("model_configs")
                .select("id, display_name, context_window, supports_thinking, input_price_per_mtok, output_price_per_mtok");
            if (customModelsError) {
                console.warn("[loadStepModelsFromDB] Failed to load custom models:", customModelsError);
            } else {
                setCustomModels((customRows ?? []).map((row) => modelConfigFromRow(row as ModelConfigRow)));
            }
            const { data: rows, error } = await database
                .from("step_model_configs")
                .select("step_name, model_id, thinking_level");

            // Backward compatibility: if DB hasn't run the thinking_level migration yet,
            // fall back to loading step→model mapping only.
            if (error) {
                const needsFallback = error.message?.toLowerCase().includes("thinking_level");
                if (!needsFallback) throw error;
                const { data: legacyRows, error: legacyError } = await database
                    .from("step_model_configs")
                    .select("step_name, model_id");
                if (legacyError) throw legacyError;
                _configuredStepModelMap.clear();
                _configuredStepThinkingLevelMap.clear();
                for (const row of legacyRows ?? []) {
                    const { step_name, model_id } = row as { step_name: string; model_id: string };
                    _configuredStepModelMap.set(step_name, model_id);
                }
                _stepModelsLoadedAt = Date.now();
                return;
            }

            _configuredStepModelMap.clear();
            _configuredStepThinkingLevelMap.clear();
            if (rows) {
                for (const row of rows) {
                    const { step_name, model_id, thinking_level } = row as {
                        step_name: string;
                        model_id: string;
                        thinking_level?: string | null;
                    };
                    _configuredStepModelMap.set(step_name, model_id);
                    if (thinking_level && isStepThinkingLevel(thinking_level)) {
                        _configuredStepThinkingLevelMap.set(step_name, thinking_level);
                    }
                }
            }
            _stepModelsLoadedAt = Date.now();
        } catch (err) {
            console.warn("[loadStepModelsFromDB] Failed to load step models:", err);
        } finally {
            _stepModelsLoadPromise = null;
        }
    })();

    await _stepModelsLoadPromise;
}
