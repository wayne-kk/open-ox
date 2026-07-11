import type { ModifyIntentCategory } from "../intent/modifyIntentRouter";
import {
  mergeModifyHistoryTurns,
  type ModifyHistoryTurn,
} from "./modifyHistoryTurn";

/** Lookback window for sticky focusFiles / lastChangeSummary. */
export const FOCUS_LOOKBACK_TURNS = 5;
/** Max paths kept on the working-memory card. */
export const FOCUS_FILES_MAX = 3;
/** Truncation for pendingQuestion / lastChangeSummary. */
export const SUMMARY_MAX_CHARS = 400;
/** Raw turns injected beside the card for the main agent. */
export const RECENT_RAW_TURNS = 2;
/** Truncation for the older of the two raw agent turns. */
export const PREV_TURN_RESULT_MAX_CHARS = 400;

/**
 * Deterministic projection of modify turns into a compact working-memory card.
 * Not durable product memory — recomputed each request from history.
 */
export type ModifyWorkingMemory = {
  focusFiles: string[];
  pendingQuestion?: string;
  lastIntent?: ModifyIntentCategory;
  lastChangeSummary?: string;
};

export type ModifyWorkingMemoryContext = {
  memory: ModifyWorkingMemory;
  recentTurns: ModifyHistoryTurn[];
  /** Injected into the main modify agent prompt. */
  agentPromptBlock: string;
  /** Injected into the intent-router LLM prompt (card only). */
  routerPromptBlock: string;
};

export function truncateForMemory(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  if (sliced.endsWith("…") || sliced.endsWith("...")) return sliced;
  return `${sliced}…`;
}

function isClearTurn(turn: ModifyHistoryTurn): boolean {
  return turn.instruction.trim() === "/clear";
}

/** Drop Studio `/clear` system rows so they do not pollute projection. */
export function filterSemanticTurns(turns: ModifyHistoryTurn[]): ModifyHistoryTurn[] {
  return turns.filter((t) => !isClearTurn(t));
}

function normalizeFocusFiles(files: string[]): string[] {
  return [
    ...new Set(
      files
        .filter((f) => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.replace(/\\/g, "/").trim())
    ),
  ].slice(0, FOCUS_FILES_MAX);
}

function findLatestChangeTurn(turns: ModifyHistoryTurn[]): ModifyHistoryTurn | undefined {
  const window = turns.slice(-FOCUS_LOOKBACK_TURNS);
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i]!.touchedFiles.length > 0) return window[i];
  }
  return undefined;
}

export function projectWorkingMemory(turns: ModifyHistoryTurn[]): ModifyWorkingMemory {
  const semantic = filterSemanticTurns(turns);
  if (semantic.length === 0) {
    return { focusFiles: [] };
  }

  const changeTurn = findLatestChangeTurn(semantic);
  const last = semantic[semantic.length - 1]!;
  const memory: ModifyWorkingMemory = {
    focusFiles: changeTurn ? normalizeFocusFiles(changeTurn.touchedFiles) : [],
  };

  if (last.awaitingReply) {
    memory.pendingQuestion = truncateForMemory(last.assistantText, SUMMARY_MAX_CHARS);
  }
  if (last.intentCategory) {
    memory.lastIntent = last.intentCategory;
  }
  if (changeTurn) {
    memory.lastChangeSummary = truncateForMemory(
      changeTurn.assistantText,
      SUMMARY_MAX_CHARS
    );
  }

  return memory;
}

export function formatWorkingMemoryCard(memory: ModifyWorkingMemory): string {
  const lines: string[] = [];
  if (memory.focusFiles.length > 0) {
    lines.push(`- focusFiles: ${memory.focusFiles.join(", ")}`);
  }
  if (memory.pendingQuestion) {
    lines.push(`- pendingQuestion: ${memory.pendingQuestion}`);
  }
  if (memory.lastIntent) {
    lines.push(`- lastIntent: ${memory.lastIntent}`);
  }
  if (memory.lastChangeSummary) {
    lines.push(`- lastChangeSummary: ${memory.lastChangeSummary}`);
  }
  if (lines.length === 0) return "";
  return `## Working memory\n${lines.join("\n")}`;
}

function formatRecentTurnsForAgent(turns: ModifyHistoryTurn[]): string {
  if (turns.length === 0) return "";
  const recent = turns.slice(-RECENT_RAW_TURNS);
  const body = recent
    .map((h, i) => {
      const isLast = i === recent.length - 1;
      const result = isLast
        ? h.assistantText
        : truncateForMemory(h.assistantText, PREV_TURN_RESULT_MAX_CHARS);
      const filesLine =
        h.touchedFiles.length > 0
          ? `\n   Files: ${h.touchedFiles.join(", ")}`
          : "";
      return `${i + 1}. User: "${h.instruction}"\n   Result: ${result}${filesLine}`;
    })
    .join("\n");
  return `## Recent turns (oldest first)\n${body}`;
}

/**
 * Single entry: merge histories → project card → format agent + router blocks.
 */
export function buildModifyWorkingMemoryContext(
  dbHistory: ModifyHistoryTurn[],
  sessionHistory: ModifyHistoryTurn[]
): ModifyWorkingMemoryContext {
  const merged = filterSemanticTurns(
    mergeModifyHistoryTurns(dbHistory, sessionHistory)
  );

  if (merged.length === 0) {
    return {
      memory: { focusFiles: [] },
      recentTurns: [],
      agentPromptBlock: "",
      routerPromptBlock: "",
    };
  }

  const memory = projectWorkingMemory(merged);
  const recentTurns = merged.slice(-RECENT_RAW_TURNS);
  const card = formatWorkingMemoryCard(memory);
  const recent = formatRecentTurnsForAgent(merged);

  const agentParts = [card, recent].filter(Boolean);
  const agentPromptBlock =
    agentParts.length > 0 ? `\n${agentParts.join("\n\n")}\n` : "";
  const routerPromptBlock = card ? `\n\n${card}\n` : "";

  return { memory, recentTurns, agentPromptBlock, routerPromptBlock };
}

/**
 * Main-agent history injection. `maxTurns` is ignored (API compat with older call sites).
 */
export function buildHistoryContext(
  dbHistory: ModifyHistoryTurn[],
  sessionHistory: ModifyHistoryTurn[],
  _maxTurns = 10
): string {
  return buildModifyWorkingMemoryContext(dbHistory, sessionHistory).agentPromptBlock;
}
