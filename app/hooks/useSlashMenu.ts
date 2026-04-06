"use client";

import { useState, useCallback, useRef } from "react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  content?: string;
  action?: () => void;
}

interface UseSlashMenuOptions {
  commands: SlashCommand[];
  value: string;
  setValue: (v: string) => void;
  onSelect?: (cmd: SlashCommand) => void;
}

/**
 * Extracts the slash query at the cursor position.
 * Returns { start, query } if a `/` is found right after a space or at position 0,
 * and the text between `/` and cursor contains no spaces.
 * Otherwise returns null.
 */
function getSlashQuery(value: string, cursorPos: number): { start: number; query: string } | null {
  // Search backwards from cursor for the `/`
  const textBeforeCursor = value.slice(0, cursorPos);
  const slashIdx = textBeforeCursor.lastIndexOf("/");
  if (slashIdx === -1) return null;

  // `/` must be at start of input or preceded by a space/newline
  if (slashIdx > 0 && !/[\s]/.test(value[slashIdx - 1])) return null;

  // Text between `/` and cursor must not contain spaces
  const query = textBeforeCursor.slice(slashIdx + 1);
  if (/\s/.test(query)) return null;

  return { start: slashIdx, query: query.toLowerCase() };
}

export function useSlashMenu({ commands, value, setValue, onSelect }: UseSlashMenuOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const cursorPosRef = useRef(0);

  // Track cursor position — called from the textarea's onChange/onSelect
  const updateCursorPos = useCallback((pos: number) => {
    cursorPosRef.current = pos;
  }, []);

  const slashQuery = getSlashQuery(value, cursorPosRef.current);
  const isOpen = slashQuery !== null;

  const matches = isOpen
    ? commands.filter((c) =>
      c.id.startsWith(slashQuery.query) ||
      c.label.toLowerCase().startsWith(slashQuery.query)
    )
    : [];

  const selectCommand = useCallback(
    (cmd: SlashCommand) => {
      const sq = getSlashQuery(value, cursorPosRef.current);
      if (sq) {
        // Remove the `/query` text from the value
        const before = value.slice(0, sq.start);
        const after = value.slice(sq.start + 1 + sq.query.length);
        setValue(before + after);
      } else {
        setValue("");
      }

      if (cmd.action) {
        cmd.action();
      } else {
        onSelect?.(cmd);
      }
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
      if (e.key === "Tab") {
        e.preventDefault();
        selectCommand(matches[activeIndex]);
        return true;
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        selectCommand(matches[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Just remove the slash query, keep the rest
        const sq = getSlashQuery(value, cursorPosRef.current);
        if (sq) {
          const before = value.slice(0, sq.start);
          const after = value.slice(sq.start + 1 + sq.query.length);
          setValue(before + after);
        }
        setActiveIndex(0);
        return true;
      }
      return false;
    },
    [isOpen, matches, activeIndex, selectCommand, setValue, value]
  );

  return { isOpen, matches, activeIndex, setActiveIndex, selectCommand, handleKeyDown, updateCursorPos };
}
