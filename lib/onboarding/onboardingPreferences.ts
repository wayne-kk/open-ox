/**
 * User-scoped new-user onboarding preferences (pure seam).
 * Persist via user_preferences.onboarding JSONB — see lib/onboarding/preferences.ts.
 */

export type OnboardingPreferences = {
  /** User chose「不再显示」— task chrome stays hidden forever. */
  dismissed: boolean;
  /** Step 1: previewable generate observed. */
  generateDone: boolean;
  /** Step 2: successful Design Mode Direct Apply. */
  designModeDone: boolean;
  /** Deep-activation observe: first Modify send already tracked. */
  firstModifySendDone: boolean;
  /** Studio ProductTour finished or skipped. */
  tourSeen: boolean;
  /** Workspace (dashboard) first-login ProductTour finished or skipped. */
  workspaceTourSeen: boolean;
};

export type OnboardingPreferencesPatch = Partial<OnboardingPreferences>;

export function defaultOnboardingPreferences(): OnboardingPreferences {
  return {
    dismissed: false,
    generateDone: false,
    designModeDone: false,
    firstModifySendDone: false,
    tourSeen: false,
    workspaceTourSeen: false,
  };
}

/** Studio checklist / Design tip should render (non-blocking task chrome). */
export function shouldShowOnboardingChrome(prefs: OnboardingPreferences): boolean {
  if (prefs.dismissed) return false;
  if (prefs.generateDone && prefs.designModeDone) return false;
  return true;
}

/**
 * Studio ProductTour — independent of the 2-step lesson and Workspace tour.
 */
export function shouldShowProductTour(prefs: OnboardingPreferences): boolean {
  if (prefs.tourSeen) return false;
  if (prefs.dismissed) return false;
  if (prefs.generateDone && prefs.designModeDone) return false;
  return true;
}

/**
 * Workspace dashboard first-login tour — lands before Studio.
 */
export function shouldShowWorkspaceTour(prefs: OnboardingPreferences): boolean {
  if (prefs.workspaceTourSeen) return false;
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
    tourSeen: patch.tourSeen ?? current.tourSeen,
    workspaceTourSeen: patch.workspaceTourSeen ?? current.workspaceTourSeen,
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
    tourSeen: asBool(o.tourSeen, base.tourSeen),
    workspaceTourSeen: asBool(o.workspaceTourSeen, base.workspaceTourSeen),
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
    "tourSeen",
    "workspaceTourSeen",
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
