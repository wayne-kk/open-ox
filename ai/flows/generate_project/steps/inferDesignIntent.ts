import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type { DesignIntent } from "../types";

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function normalizeDesignIntent(value: unknown): DesignIntent {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<DesignIntent>;
  return {
    mood: normalizeStringArray(candidate.mood, ["clean", "trustworthy", "focused"]),
    colorDirection:
      typeof candidate.colorDirection === "string" && candidate.colorDirection.trim()
        ? candidate.colorDirection.trim()
        : "Neutral base with one clear accent direction.",
    style:
      typeof candidate.style === "string" && candidate.style.trim()
        ? candidate.style.trim()
        : "Modern, content-first, conversion-oriented.",
    keywords: normalizeStringArray(candidate.keywords, [
      "clean",
      "professional",
      "focused",
      "confident",
      "modern",
    ]),
  };
}

export async function stepInferDesignIntent(
  userInput: string
): Promise<DesignIntent> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("inferDesignIntent"),
    loadGuardrail("outputJson"),
  ]);

  const userMessage = `## User Requirement
${userInput}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.4, 500);
    const parsed = JSON.parse(extractJSON(raw)) as { designIntent?: unknown } | DesignIntent;
    return normalizeDesignIntent("designIntent" in parsed ? parsed.designIntent : parsed);
  } catch {
    return normalizeDesignIntent(undefined);
  }
}
