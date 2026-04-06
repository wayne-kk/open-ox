"use client";

import { useState, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type TriggerType = "slash" | "at" | "hash";

export interface TriggerItem {
  id: string;
  label: string;
  description: string;
  type: TriggerType;
  /** Extra data carried by this item (e.g. skill markdown, project designSystem) */
  meta?: Record<string, unknown>;
}

export interface InjectedChip {
  id: string;
  label: string;
  type: TriggerType | "url";
  /** Payload sent to the backend on submit */
  payload: Record<string, unknown>;
}

interface TriggerQuery {
  start: number;
  query: string;
  trigger: TriggerType;
  char: string;
}

interface UsePromptTriggersOptions {
  /** All available trigger items, grouped by type */
  items: TriggerItem[];
  value: string;
  setValue: (v: string) => void;
  /** Called when a trigger item is selected */
  onSelect?: (item: TriggerItem) => void;
}

// ── Trigger detection ────────────────────────────────────────────────────────

const TRIGGER_CHARS: Record<string, TriggerType> = {
  "/": "slash",
  "@": "at",
  "#": "hash",
};

/**
 * Finds the active trigger query at the cursor position.
 * Supports /, @, # — the trigger char must be at start of input or after whitespace,
 * and the text between trigger and cursor must not contain spaces.
 */
function detectTrigger(value: string, cursorPos: number): TriggerQuery | null {
  const before = value.slice(0, cursorPos);

  for (const [char, type] of Object.entries(TRIGGER_CHARS)) {
    const idx = before.lastIndexOf(char);
    if (idx === -1) continue;
    // Must be at start or after whitespace
    if (idx > 0 && !/[\s]/.test(value[idx - 1])) continue;
    // Query between trigger and cursor must not contain spaces
    const query = before.slice(idx + 1);
    if (/\s/.test(query)) continue;
    return { start: idx, query: query.toLowerCase(), trigger: type, char };
  }
  return null;
}

/**
 * Detects URLs in the input text. Returns the first URL found, or null.
 */
export function detectUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePromptTriggers({ items, value, setValue, onSelect }: UsePromptTriggersOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cursorPosRef = useRef(0);

  const updateCursorPos = useCallback((pos: number) => {
    cursorPosRef.current = pos;
  }, []);

  const triggerQuery = detectTrigger(value, cursorPosRef.current);
  const isOpen = triggerQuery !== null;
  const activeTriggerType = triggerQuery?.trigger ?? null;

  const matches = isOpen
    ? items
        .filter((item) => item.type === triggerQuery.trigger)
        .filter((item) =>
          item.id.toLowerCase().startsWith(triggerQuery.query) ||
          item.label.toLowerCase().startsWith(triggerQuery.query)
        )
        .slice(0, 20) // cap results
    : [];

  const selectItem = useCallback(
    (item: TriggerItem) => {
      const tq = detectTrigger(value, cursorPosRef.current);
      if (tq) {
        const before = value.slice(0, tq.start);
        const after = value.slice(tq.start + 1 + tq.query.length);
        setValue(before + after);
      }
      onSelect?.(item);
      setActiveIndex(0);
    },
    [onSelect, setValue, value]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || matches.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return true;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey)) {
        e.preventDefault();
        selectItem(matches[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const tq = detectTrigger(value, cursorPosRef.current);
        if (tq) {
          const before = value.slice(0, tq.start);
          const after = value.slice(tq.start + 1 + tq.query.length);
          setValue(before + after);
        }
        setActiveIndex(0);
        return true;
      }
      return false;
    },
    [isOpen, matches, activeIndex, selectItem, setValue, value]
  );

  return {
    isOpen,
    matches,
    activeIndex,
    activeTriggerType,
    setActiveIndex,
    selectItem,
    handleKeyDown,
    updateCursorPos,
  };
}
