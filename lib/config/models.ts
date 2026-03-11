// lib/config/models.ts
export const MODELS = {
    'gemini-3.1-pro-preview': { displayName: 'Gemini 2.5 Flash', contextWindow: 128_000 },
    'gpt-5.2': { displayName: 'GPT-4o', contextWindow: 128_000 },
    // ...
} as const;

export type ModelId = keyof typeof MODELS;

export function getModelId(): ModelId {
    const id = process.env.OPENAI_MODEL;
    if (!id || !(id in MODELS)) {
        throw new Error(`Invalid OPENAI_MODEL: ${id}. Must be one of: ${Object.keys(MODELS).join(', ')}`);
    }
    return id as ModelId;
}