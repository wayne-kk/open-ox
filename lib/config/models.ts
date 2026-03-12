// lib/config/models.ts
export const MODELS = {
    'gemini-3.1-pro-preview': { displayName: 'Gemini 2.5 Flash', contextWindow: 128_000 },
    'gpt-5.2': { displayName: 'GPT-4o', contextWindow: 128_000 },
    // ...
} as const;

export type ModelId = keyof typeof MODELS;

export function getModelId(): ModelId {
    const id = process.env.OPENAI_MODEL || 'gpt-5.2';
    return id as ModelId;
}