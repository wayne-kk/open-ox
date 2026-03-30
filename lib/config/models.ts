// lib/config/models.ts
export const MODELS = {
    'gemini-3.1-pro-preview': { displayName: 'Gemini 3.1 Pro Preview', contextWindow: 128_000 },
    'gpt-5.2': { displayName: 'GPT-5.2', contextWindow: 128_000 },
    'gemini-3-flash-preview': { displayName: 'Gemini 3 Flash Preview', contextWindow: 128_000 },
    // ...
} as const;

export type ModelId = keyof typeof MODELS;

export function getModelId(): ModelId {
    const id = process.env.OPENAI_MODEL || 'gemini-3.1-pro-preview';
    return id as ModelId;
}