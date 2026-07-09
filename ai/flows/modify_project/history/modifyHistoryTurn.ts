import type { ModificationRecord } from "@/lib/projectManager";
import type { ModifyIntentCategory } from "../intent/modifyIntentRouter";

/**
 * One completed modify exchange — shared across Studio, HTTP, continuation, and prompts.
 * Not the DB row (`ModificationRecord`) and not the Studio UI record.
 */
export type ModifyHistoryTurn = {
  instruction: string;
  assistantText: string;
  touchedFiles: string[];
  intentCategory?: ModifyIntentCategory;
  awaitingReply: boolean;
};

/** Structured body sent as `conversationHistory` from Studio → POST /modify. */
export type ModifyClientHistoryPayload = {
  instruction: string;
  assistantText: string;
  touchedFiles: string[];
  intentCategory?: ModifyIntentCategory;
  /** Legacy dual-read: older clients sent a single summary with embedded `Files:`. */
  summary?: string;
};

const INTENT_CATEGORIES = new Set<ModifyIntentCategory>([
  "conversation",
  "read_only",
  "plan_only",
  "code_change",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseIntentCategory(raw: unknown): ModifyIntentCategory | undefined {
  return typeof raw === "string" && INTENT_CATEGORIES.has(raw as ModifyIntentCategory)
    ? (raw as ModifyIntentCategory)
    : undefined;
}

function normalizeTouchedFiles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.replace(/\\/g, "/").trim())
    ),
  ];
}

/** Split legacy `analysis Files: a.ts, b.ts` into text + files. */
export function splitLegacySummary(summary: string): {
  assistantText: string;
  touchedFiles: string[];
} {
  const match = summary.match(/^(.*?)(?:\s+Files:\s*([\s\S]*))?$/);
  if (!match) {
    return { assistantText: summary.trim(), touchedFiles: [] };
  }
  const assistantText = (match[1] ?? "").trim();
  const filesPart = (match[2] ?? "").trim();
  const touchedFiles = filesPart
    ? filesPart
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
    : [];
  return { assistantText, touchedFiles };
}

export function computeAwaitingReply(
  assistantText: string,
  touchedFiles: string[]
): boolean {
  const body = assistantText.trim();
  if (!body) return false;

  if (/[?？]/.test(body)) return true;

  if (
    /请(你|告|说|确认|补充|选择)|需要你|能否|是否可以|要不要|哪个|哪种|多少|哪一种|哪一项/.test(
      body
    )
  ) {
    return true;
  }

  if (
    /Modified 0 file\(s\)|made no changes|but made no changes|未修改|0 file\(s\)/i.test(
      body
    )
  ) {
    return true;
  }

  if (touchedFiles.length === 0 && /Failed:/i.test(body)) {
    return true;
  }

  if (/确认执行|按这个计划修改|Planned target — not executed/i.test(body)) {
    return true;
  }

  return false;
}

function resolveAssistantText(options: {
  analysis?: string | null;
  error?: string | null;
  touchedFiles: string[];
}): string {
  const analysis = options.analysis?.trim();
  if (analysis) {
    return splitLegacySummary(analysis).assistantText;
  }
  if (options.error?.trim()) {
    return `Failed: ${options.error.trim()}`;
  }
  return `Modified ${options.touchedFiles.length} file(s)`;
}

export function fromModificationRecord(record: ModificationRecord): ModifyHistoryTurn {
  const fromAnalysis = record.plan?.analysis
    ? splitLegacySummary(record.plan.analysis)
    : null;
  const touchedFiles =
    record.touchedFiles.length > 0
      ? [...record.touchedFiles]
      : (fromAnalysis?.touchedFiles ?? []);
  const assistantText = resolveAssistantText({
    analysis: record.plan?.analysis,
    error: record.error,
    touchedFiles,
  });
  return {
    instruction: record.instruction,
    assistantText,
    touchedFiles,
    intentCategory: record.intentCategory,
    awaitingReply: computeAwaitingReply(assistantText, touchedFiles),
  };
}

/**
 * Studio / callers → HTTP payload (no `awaitingReply`; server computes it).
 */
export function toClientHistoryPayload(source: {
  instruction: string;
  analysis?: string | null;
  error?: string | null;
  touchedFiles: string[];
  intentCategory?: ModifyIntentCategory;
}): ModifyClientHistoryPayload {
  const touchedFiles = normalizeTouchedFiles(source.touchedFiles);
  return {
    instruction: source.instruction,
    assistantText: resolveAssistantText({
      analysis: source.analysis,
      error: source.error,
      touchedFiles,
    }),
    touchedFiles,
    ...(source.intentCategory ? { intentCategory: source.intentCategory } : {}),
  };
}

/**
 * Dual-read: prefer structured fields; fall back to legacy `summary` with `Files:`.
 */
export function fromClientPayload(raw: unknown): ModifyHistoryTurn | null {
  if (!isRecord(raw)) return null;
  const instruction = typeof raw.instruction === "string" ? raw.instruction : "";
  if (!instruction.trim()) return null;

  let assistantText = "";
  let touchedFiles = normalizeTouchedFiles(raw.touchedFiles);
  const intentCategory = parseIntentCategory(raw.intentCategory);

  if (typeof raw.assistantText === "string" && raw.assistantText.trim()) {
    assistantText = raw.assistantText.trim();
  } else if (typeof raw.summary === "string" && raw.summary.trim()) {
    const legacy = splitLegacySummary(raw.summary);
    assistantText = legacy.assistantText;
    if (touchedFiles.length === 0) touchedFiles = legacy.touchedFiles;
  } else if (typeof raw.error === "string" && raw.error.trim()) {
    assistantText = `Failed: ${raw.error.trim()}`;
  } else {
    assistantText = `Modified ${touchedFiles.length} file(s)`;
  }

  return {
    instruction,
    assistantText,
    touchedFiles,
    intentCategory,
    awaitingReply: computeAwaitingReply(assistantText, touchedFiles),
  };
}

export function mergeModifyHistoryTurns(
  dbHistory: ModifyHistoryTurn[],
  sessionHistory: ModifyHistoryTurn[]
): ModifyHistoryTurn[] {
  const seenInstructions = new Set(dbHistory.map((h) => h.instruction));
  return [
    ...dbHistory,
    ...sessionHistory.filter((h) => !seenInstructions.has(h.instruction)),
  ];
}

export function formatHistoryForAgent(turns: ModifyHistoryTurn[]): string {
  if (turns.length === 0) return "";
  return `\n## Previous Modifications (conversation memory)\n${turns
    .map((h, i) => {
      const filesLine =
        h.touchedFiles.length > 0
          ? `\n   Files: ${h.touchedFiles.join(", ")}`
          : "";
      return `${i + 1}. User: "${h.instruction}"\n   Result: ${h.assistantText}${filesLine}`;
    })
    .join("\n")}\n`;
}

export function formatRecentHistoryForRouter(turns: ModifyHistoryTurn[]): string {
  if (turns.length === 0) return "";
  return `\n\n## Recent modify conversation (oldest first — use for follow-up replies)\n${turns
    .map(
      (h, i) =>
        `${i + 1}. User: "${h.instruction}"\n   Assistant: ${h.assistantText.slice(0, 600)}`
    )
    .join("\n")}\n`;
}

export function buildHistoryContext(
  dbHistory: ModifyHistoryTurn[],
  sessionHistory: ModifyHistoryTurn[],
  maxTurns = 10
): string {
  const recent = mergeModifyHistoryTurns(dbHistory, sessionHistory).slice(-maxTurns);
  return formatHistoryForAgent(recent);
}
