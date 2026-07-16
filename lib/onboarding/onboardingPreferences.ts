/**
 * User-scoped new-user onboarding preferences (pure seam).
 * Persist via user_preferences.onboarding JSONB — see lib/onboarding/preferences.ts.
 */

export type OnboardingPreferences = {
  /** User chose「不再显示」— chrome stays hidden forever. */
  dismissed: boolean;
  /** Step 1: previewable generate observed. */
  generateDone: boolean;
  /** Step 2: successful Design Mode Direct Apply. */
  designModeDone: boolean;
  /** Deep-activation observe: first Modify send already tracked. */
  firstModifySendDone: boolean;
};

export type OnboardingPreferencesPatch = Partial<OnboardingPreferences>;

export function defaultOnboardingPreferences(): OnboardingPreferences {
  return {
    dismissed: false,
    generateDone: false,
    designModeDone: false,
    firstModifySendDone: false,
  };
}

/** Studio checklist / Design tip should render. */
export function shouldShowOnboardingChrome(prefs: OnboardingPreferences): boolean {
  if (prefs.dismissed) return false;
  if (prefs.generateDone && prefs.designModeDone) return false;
  return true;
}

export function mergeOnboardingPatch(
  current: OnboardingPreferences,
  patch: OnboardingPreferencesPatch
): OnboardingPreferences {
  return {
    dismissed: patch.dismissed ?? current.dismissed,
    generateDone: patch.generateDone ?? current.generateDone,
    designModeDone: patch.designModeDone ?? current.designModeDone,
    firstModifySendDone: patch.firstModifySendDone ?? current.firstModifySendDone,
  };
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Parse DB JSONB / API body into a full prefs object (unknown → defaults). */
export function parseOnboardingPreferences(raw: unknown): OnboardingPreferences {
  const base = defaultOnboardingPreferences();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    dismissed: asBool(o.dismissed, base.dismissed),
    generateDone: asBool(o.generateDone, base.generateDone),
    designModeDone: asBool(o.designModeDone, base.designModeDone),
    firstModifySendDone: asBool(o.firstModifySendDone, base.firstModifySendDone),
  };
}

/** Only allow known boolean keys from a client PATCH body. */
export function parseOnboardingPatch(raw: unknown): OnboardingPreferencesPatch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const patch: OnboardingPreferencesPatch = {};
  let any = false;
  for (const key of [
    "dismissed",
    "generateDone",
    "designModeDone",
    "firstModifySendDone",
  ] as const) {
    if (key in o) {
      if (typeof o[key] !== "boolean") return null;
      patch[key] = o[key];
      any = true;
    }
  }
  return any ? patch : null;
}

/** Debug / QA: `PATCH { "reset": true }` wipes onboarding progress. */
export function isOnboardingResetRequest(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      (raw as Record<string, unknown>).reset === true
  );
}
