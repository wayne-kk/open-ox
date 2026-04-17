"use client";

import { useEffect, useRef } from "react";
import { useFavicon, type FaviconState } from "@/app/contexts/FaviconContext";

/**
 * Syncs AI build/modify states to the dynamic favicon.
 *
 * Drop this into any component that has access to loading/error states:
 *
 *   useFaviconSync({ loading, modifying, error });
 *
 * State mapping:
 *   loading || modifying  → "thinking"
 *   error (transient)     → "error" (auto-reverts)
 *   done (was loading)    → "notify" (auto-reverts)
 *   otherwise             → "idle"
 */
export function useFaviconSync({
  loading = false,
  modifying = false,
  error = null as string | null | undefined,
}: {
  loading?: boolean;
  modifying?: boolean;
  error?: string | null;
}) {
  const { setState, flashNotify, flashError } = useFavicon();
  const prevLoadingRef = useRef(false);
  const prevModifyingRef = useRef(false);

  useEffect(() => {
    const wasWorking = prevLoadingRef.current || prevModifyingRef.current;
    const isWorking = loading || modifying;

    if (isWorking) {
      // AI is processing
      setState("thinking");
    } else if (wasWorking && !isWorking) {
      // Just finished
      if (error) {
        flashError();
      } else {
        flashNotify();
      }
    }
    // If not working and wasn't working, leave state as-is (idle or reverting)

    prevLoadingRef.current = loading;
    prevModifyingRef.current = modifying;
  }, [loading, modifying, error, setState, flashNotify, flashError]);
}
