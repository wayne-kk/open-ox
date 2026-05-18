import type { BriefSubstanceClassification } from "./briefSubstanceClassifier";
import type { ChatMessage } from "@/ai/shared/llm/types";

/** Enough characters that the string is unlikely to be a pure confirmation cue. */
export const SUBSTANTIVE_MIN = 48;
/** When merged brief classifier LLM fails, treat tool `merged_brief` this long as substantive. */
export const DRAFT_FALLBACK_MIN = 24;
const TINY_HOLD_MIN = 16;

/** Blueprint titles longer than this are almost never display names — skip DB rename. */
const MAX_PROJECT_TITLE_CHARS = 80;

/**
 * Reads the newest `yield_to_user.brief_draft_markdown` from assistant tool_calls before the trailing user bubble.
 */
export function extractLatestYieldBriefDraft(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 1; i -= 1) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const raw = (m.tool_calls ??
      []) as Array<{ type?: unknown; id?: unknown; function?: { name?: string; arguments?: string } }>;
    const list = Array.isArray(raw) ? raw : [];
    for (const tc of [...list].reverse()) {
      if (typeof tc.function?.name !== "string" || tc.function.name !== "yield_to_user") continue;
      try {
        const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
        const draft =
          typeof args.brief_draft_markdown === "string" ? args.brief_draft_markdown.trim() : "";
        if (draft.length >= DRAFT_FALLBACK_MIN) return draft;
      } catch {
        /* ignore malformed JSON */
      }
    }
  }
  return null;
}

/**
 * Reconcile `merged_brief` from commit_generate vs session.
 * Whether each candidate is "real brief vs confirm-only" comes from {@link classifyBriefSubstanceForCommit} — no local phrase/regex heuristics.
 */
export function resolveCommitMergedBrief(params: {
  mergedBriefRaw: string;
  messages: ChatMessage[];
  tailUserMessage: string;
  bootstrapUserPrompt?: string | null;
  substance: BriefSubstanceClassification;
}): string {
  const raw = params.mergedBriefRaw.trim();
  const draft = extractLatestYieldBriefDraft(params.messages)?.trim() ?? "";
  const bootstrap = (params.bootstrapUserPrompt ?? "").trim();
  const tail = params.tailUserMessage.trim();
  const { substance } = params;

  const rawSubstantive =
    raw.length >= SUBSTANTIVE_MIN && substance.mergedBriefFieldSubstantive;

  if (rawSubstantive) return raw;

  if (draft.length >= SUBSTANTIVE_MIN) return draft;

  if (bootstrap.length >= SUBSTANTIVE_MIN && substance.bootstrapSubstantive) return bootstrap;

  if (draft.length >= DRAFT_FALLBACK_MIN) return draft;

  if (tail.length >= SUBSTANTIVE_MIN && substance.tailSubstantive) return tail;

  if (raw.length >= DRAFT_FALLBACK_MIN && substance.mergedBriefFieldSubstantive) return raw;

  if (bootstrap.length >= DRAFT_FALLBACK_MIN) return bootstrap;

  if (draft.length >= TINY_HOLD_MIN) return draft;

  if (raw.length >= TINY_HOLD_MIN && substance.mergedBriefFieldSubstantive) return raw;

  if (bootstrap) return bootstrap;

  return draft || raw || tail;
}

/**
 * Prevent renaming the DB row from a bad analyze pass.
 * Uses title shape only (length, layout) so short real names stay valid.
 */
export function shouldSkipNamingFromBlueprintTitle(title: string): boolean {
  const t = title.trim();
  if (!t.length) return true;
  if (t.length > MAX_PROJECT_TITLE_CHARS) return true;
  if (/[\r\n]/.test(t)) return true;
  if (/^\s*#{1,6}\s|^\s*[-*]\s|^\s*\d+[.)]\s/m.test(t)) return true;
  return false;
}
