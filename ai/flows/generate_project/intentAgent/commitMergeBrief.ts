import type { ChatMessage } from "@/ai/shared/llm/types";

/** Enough characters that the string is unlikely to be a pure confirmation cue. */
const SUBSTANTIVE_MIN = 48;
const DRAFT_FALLBACK_MIN = 24;
const TINY_HOLD_MIN = 16;

/** Phrases users send on the confirm turn instead of substantive briefs — must not sole-source generation. */
const META_COMMIT_PATTERNS: RegExp[] = [
  /^就这样\b/iu,
  /开始生成/iu,
  /^好的\b/iu,
  /^好吧\b/iu,
  /^行行行/iu,
  /^确认了?\b/iu,
  /^可以了\b/iu,
  /^可以的\b/iu,
  /^行[,，.。!！]?\s*$/iu,
  /^嗯+[，。\s!.]*$/iu,
  /^对对/iu,
  /^是的\b/iu,
  /^同上\b/iu,
  /^照旧\b/iu,
  /^按这个来\b/iu,
  /^直接生成\b/iu,
  /^开搞\b/iu,
  /^开工\b/iu,
  /^走起\b/iu,
  /^建站吧\b/iu,
  /^就这样吧\b/iu,
  /^ok\b[,!.。\s]*$/iu,
  /^yes\b[,!.。\s]*$/iu,
  /^yep\b[,!.。\s]*$/iu,
  /^sure\b[,!.。\s]*$/iu,
];

function isMostlyMetaAgreement(text: string): boolean {
  const t = text.trim();
  if (!t.length) return true;
  if (t.length > 120) return false;
  if (META_COMMIT_PATTERNS.some((p) => p.test(t))) return true;
  // Very short, no obvious product noun tokens
  if (t.length <= 36 && !/[网站页品牌产品首页落地SaaSB2B控制台官网关于联系服务价格团队案例]/.test(t)) {
    return true;
  }
  return false;
}

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
 * Reconcile `merged_brief` from commit_generate vs session — avoids using the trailing
 * 「就这样」「开始生成吧」alone as analyze input when the model omits merged_brief.
 */
export function resolveCommitMergedBrief(params: {
  mergedBriefRaw: string;
  messages: ChatMessage[];
  tailUserMessage: string;
  bootstrapUserPrompt?: string | null;
}): string {
  const raw = params.mergedBriefRaw.trim();
  const draft = extractLatestYieldBriefDraft(params.messages)?.trim() ?? "";
  const bootstrap = (params.bootstrapUserPrompt ?? "").trim();
  const tail = params.tailUserMessage.trim();

  const rawSubstantive = raw.length >= SUBSTANTIVE_MIN && !isMostlyMetaAgreement(raw);

  if (rawSubstantive) return raw;

  if (draft.length >= SUBSTANTIVE_MIN) return draft;

  if (bootstrap.length >= SUBSTANTIVE_MIN && !isMostlyMetaAgreement(bootstrap)) return bootstrap;

  if (draft.length >= DRAFT_FALLBACK_MIN) return draft;

  if (tail.length >= SUBSTANTIVE_MIN && !isMostlyMetaAgreement(tail)) return tail;

  if (raw.length >= DRAFT_FALLBACK_MIN && !isMostlyMetaAgreement(raw)) return raw;

  if (bootstrap.length >= DRAFT_FALLBACK_MIN) return bootstrap;

  if (draft.length >= TINY_HOLD_MIN) return draft;

  if (raw.length >= TINY_HOLD_MIN && !isMostlyMetaAgreement(raw)) return raw;

  if (bootstrap) return bootstrap;

  return draft || raw || tail;
}

/** Prevent renaming the DB row to conversational junk from a bad analyze pass. */
export function shouldSkipNamingFromBlueprintTitle(title: string): boolean {
  const t = title.trim();
  if (!t.length) return true;
  return t.length < SUBSTANTIVE_MIN || isMostlyMetaAgreement(t);
}
