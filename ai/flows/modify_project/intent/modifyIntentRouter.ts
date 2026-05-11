import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";

export type ModifyIntentCategory = "conversation" | "read_only" | "code_change";

export interface ModifyIntentRouterResult {
  category: ModifyIntentCategory;
  assistantMessage: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Pure parse — used by tests and after LLM JSON extract. */
export function parseModifyIntentRouterPayload(parsed: unknown): ModifyIntentRouterResult {
  const root = isRecord(parsed) ? parsed : {};
  const raw = root.category;
  let category: ModifyIntentCategory = "code_change";
  if (raw === "conversation" || raw === "read_only" || raw === "code_change") {
    category = raw;
  }
  const assistantMessage =
    typeof root.assistantMessage === "string" ? root.assistantMessage.trim() : "";
  return { category, assistantMessage };
}

/**
 * LLM intent router — same pattern as {@link stepProjectIntentGuide}.
 */
export async function stepModifyIntentRouter(userInstruction: string): Promise<ModifyIntentRouterResult> {
  const trimmed = userInstruction.trim();
  if (!trimmed) {
    return { category: "code_change", assistantMessage: "" };
  }

  const model = getModelForStep("modify_intent_router");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("modifyIntentRouter"),
    loadGuardrail("outputJson"),
  ]);

  const meta = await callLLMWithMeta(systemPrompt, trimmed, 0.35, undefined, model, {
    langfuseName: lfPlain(LfPlain.modifyIntentRouter),
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(meta.content));
  } catch {
    throw new Error(
      `modify_intent_router: failed to parse JSON.\nRaw output:\n${meta.content.slice(0, 4000)}`
    );
  }

  return parseModifyIntentRouterPayload(parsed);
}
