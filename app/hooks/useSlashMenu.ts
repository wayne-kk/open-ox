"use client";

import { useState, useCallback } from "react";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  /** If provided, this content will be appended to the prompt on selection */
  content?: string;
  action?: () => void;
}

interface UseSlashMenuOptions {
  commands: SlashCommand[];
  value: string;
  setValue: (v: string) => void;
  /** Called when a command with no action is selected — receives the command */
  onSelect?: (cmd: SlashCommand) => void;
}

export function useSlashMenu({ commands, value, setValue, onSelect }: UseSlashMenuOptions) {
  const [activeIndex, setActiveIndex] = useState(0);

  const isOpen = value.startsWith("/") && !value.includes(" ");

  const matches = isOpen
    ? commands.filter((c) => c.id.startsWith(value.slice(1).toLowerCase()) || c.label.toLowerCase().startsWith(value.slice(1).toLowerCase()))
    : [];

  const selectCommand = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.action) {
        cmd.action();
        setValue("");
      } else {
        onSelect?.(cmd);
        setValue("");
      }
      setActiveIndex(0);
    },
    [onSelect, setValue]
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
        setValue("/" + matches[activeIndex].id);
        return true;
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        selectCommand(matches[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        setActiveIndex(0);
        return true;
      }
      return false;
    },
    [isOpen, matches, activeIndex, selectCommand, setValue]
  );

  return { isOpen, matches, activeIndex, setActiveIndex, selectCommand, handleKeyDown };
}
