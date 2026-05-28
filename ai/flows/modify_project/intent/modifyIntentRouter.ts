import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "@/ai/flows/generate_project/shared/files";
import { callLLMWithMeta, extractJSON } from "@/ai/flows/generate_project/shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { getModelForStep } from "@/lib/config/models";

export type ModifyIntentCategory = "conversation" | "read_only" | "plan_only" | "code_change";

export type ModifyScope = "style" | "narrow" | "broad";

export interface ModifyIntentRouterResult {
  category: ModifyIntentCategory;
  /** Execution scope — only used when category is code_change. Chosen by this router, not heuristics downstream. */
  scope: ModifyScope;
  /** Up to 5 repo-relative paths to preload (read_only / plan_only / code_change). */
  preloadPaths: string[];
  assistantMessage: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseScope(raw: unknown): ModifyScope {
  if (raw === "style" || raw === "narrow" || raw === "broad") return raw;
  return "narrow";
}

function parsePreloadPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.replace(/\\/g, "/").replace(/^(\.\/)+/, ""))
    .slice(0, 5);
}

function parseCategory(raw: unknown): ModifyIntentCategory {
  if (
    raw === "conversation" ||
    raw === "read_only" ||
    raw === "plan_only" ||
    raw === "code_change"
  ) {
    return raw;
  }
  return "read_only";
}

/** Pure parse — used by tests and after LLM JSON extract. */
export function parseModifyIntentRouterPayload(parsed: unknown): ModifyIntentRouterResult {
  const root = isRecord(parsed) ? parsed : {};
  const category = parseCategory(root.category);
  const assistantMessage =
    typeof root.assistantMessage === "string" ? root.assistantMessage.trim() : "";

  const scope = category === "code_change" ? parseScope(root.scope) : "narrow";
  const preloadPaths =
    category === "conversation" ? [] : parsePreloadPaths(root.preloadPaths);

  return { category, scope, preloadPaths, assistantMessage };
}

/**
 * LLM intent router — classifies category, execution scope, and optional context preload paths.
 */
export async function stepModifyIntentRouter(
  userInstruction: string,
  options?: { fileTree?: string }
): Promise<ModifyIntentRouterResult> {
  const trimmed = userInstruction.trim();
  if (!trimmed) {
    return { category: "read_only", scope: "narrow", preloadPaths: [], assistantMessage: "" };
  }

  const model = getModelForStep("modify_intent_router");
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("modifyIntentRouter"),
    loadGuardrail("outputJson"),
  ]);

  const userPayload = options?.fileTree?.trim()
    ? `${trimmed}\n\n## Project file tree (pick preloadPaths from these paths only)\n\`\`\`\n${options.fileTree.trim()}\n\`\`\``
    : trimmed;

  const meta = await callLLMWithMeta(systemPrompt, userPayload, 0.35, undefined, model, {
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
