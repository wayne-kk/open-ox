import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Control-flow tools — extensions must not register the same names.
 */
export const INTENT_AGENT_RESERVED_TOOL_NAMES = new Set(["yield_to_user", "commit_generate"]);

export function intentAgentFunctionName(tool: ChatCompletionTool): string | null {
  if (!tool || tool.type !== "function") return null;
  const raw = typeof tool.function?.name === "string" ? tool.function.name.trim() : "";
  return raw.length > 0 ? raw : null;
}

/**
 * `base` first (includes reserved control tools), then `extensions` with new names only.
 */
export function mergeIntentAgentTools(params: {
  base: ChatCompletionTool[];
  extensions?: ChatCompletionTool[] | undefined | null;
}): ChatCompletionTool[] {
  const seen = new Set<string>();
  const out: ChatCompletionTool[] = [];

  for (const t of params.base) {
    const name = intentAgentFunctionName(t);
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(t);
  }

  for (const t of params.extensions ?? []) {
    const name = intentAgentFunctionName(t);
    if (!name) continue;
    if (INTENT_AGENT_RESERVED_TOOL_NAMES.has(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(t);
  }

  return out;
}

/** HTTP helper: validate loosely; reserved names stripped; dedupe by name. */
export function coerceAdditionalToolsFromJson(raw: unknown, maxEntries = 32): ChatCompletionTool[] {
  if (!Array.isArray(raw)) return [];
  const namePattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
  const candidates: ChatCompletionTool[] = [];

  for (const item of raw.slice(0, maxEntries)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "function") continue;
    const func = o.function;
    if (!func || typeof func !== "object") continue;
    const fn = func as Record<string, unknown>;
    const name = typeof fn.name === "string" ? fn.name.trim() : "";
    if (!name || !namePattern.test(name)) continue;
    if (INTENT_AGENT_RESERVED_TOOL_NAMES.has(name)) continue;
    candidates.push(item as ChatCompletionTool);
  }

  const seen = new Set<string>();
  return candidates.filter((t) => {
    const n = intentAgentFunctionName(t);
    if (!n) return false;
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}
