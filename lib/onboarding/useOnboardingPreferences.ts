"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultOnboardingPreferences,
  shouldShowOnboardingChrome,
  type OnboardingPreferences,
  type OnboardingPreferencesPatch,
} from "@/lib/onboarding/onboardingPreferences";

type State = {
  prefs: OnboardingPreferences;
  loading: boolean;
  ready: boolean;
};

export type UseOnboardingPreferencesOptions = {
  /**
   * Debug gate: `?ox_onboarding=1`
   * - resets server prefs once on mount
   * - forces checklist chrome visible even if prefs say hide
   */
  debugForce?: boolean;
};

export function useOnboardingPreferences(opts: UseOnboardingPreferencesOptions = {}) {
  const { debugForce = false } = opts;
  const [{ prefs, loading, ready }, setState] = useState<State>({
    prefs: defaultOnboardingPreferences(),
    loading: true,
    ready: false,
  });
  const resetDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/me/onboarding");
      if (res.status === 401) {
        setState({
          prefs: defaultOnboardingPreferences(),
          loading: false,
          ready: true,
        });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { onboarding?: OnboardingPreferences };
      setState({
        prefs: data.onboarding ?? defaultOnboardingPreferences(),
        loading: false,
        ready: true,
      });
    } catch {
      setState((s) => ({ ...s, loading: false, ready: true }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debug gate: wipe progress once so you can re-walk the funnel
  useEffect(() => {
    if (!debugForce || resetDoneRef.current) return;
    resetDoneRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/me/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { onboarding?: OnboardingPreferences };
        setState({
          prefs: data.onboarding ?? defaultOnboardingPreferences(),
          loading: false,
          ready: true,
        });
      } catch {
        setState({
          prefs: defaultOnboardingPreferences(),
          loading: false,
          ready: true,
        });
      }
    })();
  }, [debugForce]);

  const patch = useCallback(async (next: OnboardingPreferencesPatch) => {
    setState((s) => ({
      ...s,
      prefs: { ...s.prefs, ...next },
    }));
    try {
      const res = await fetch("/api/me/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { onboarding?: OnboardingPreferences };
      if (data.onboarding) {
        setState((s) => ({ ...s, prefs: data.onboarding!, loading: false, ready: true }));
      }
    } catch {
      void refresh();
    }
  }, [refresh]);

  const showChrome = debugForce || shouldShowOnboardingChrome(prefs);

  return {
    prefs,
    loading,
    ready,
    showChrome,
    debugForce,
    refresh,
    patch,
  };
}
