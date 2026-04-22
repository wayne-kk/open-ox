"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

// ── Favicon States ───────────────────────────────────────────────────────────

export type FaviconState = "idle" | "thinking" | "notify" | "error";

interface FaviconContextValue {
  /** Current favicon state */
  state: FaviconState;
  /** Set favicon to a specific state */
  setState: (s: FaviconState) => void;
  /** Convenience: set thinking, auto-revert to idle when done */
  startThinking: () => void;
  /** Convenience: flash notify then revert to idle */
  flashNotify: (durationMs?: number) => void;
  /** Convenience: flash error then revert to idle */
  flashError: (durationMs?: number) => void;
}

const FaviconContext = createContext<FaviconContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function FaviconProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<FaviconState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setState = useCallback(
    (s: FaviconState) => {
      clearTimer();
      setStateRaw(s);
    },
    [clearTimer],
  );

  const startThinking = useCallback(() => {
    clearTimer();
    setStateRaw("thinking");
  }, [clearTimer]);

  const flashNotify = useCallback(
    (durationMs = 3000) => {
      clearTimer();
      setStateRaw("notify");
      timerRef.current = setTimeout(() => setStateRaw("idle"), durationMs);
    },
    [clearTimer],
  );

  const flashError = useCallback(
    (durationMs = 2500) => {
      clearTimer();
      setStateRaw("error");
      timerRef.current = setTimeout(() => setStateRaw("idle"), durationMs);
    },
    [clearTimer],
  );

  return (
    <FaviconContext.Provider value={{ state, setState, startThinking, flashNotify, flashError }}>
      {children}
    </FaviconContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFavicon() {
  const ctx = useContext(FaviconContext);
  if (!ctx) throw new Error("useFavicon must be used within <FaviconProvider>");
  return ctx;
}
