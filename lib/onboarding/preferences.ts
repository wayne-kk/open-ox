import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultOnboardingPreferences,
  mergeOnboardingPatch,
  parseOnboardingPreferences,
  type OnboardingPreferences,
  type OnboardingPreferencesPatch,
} from "@/lib/onboarding/onboardingPreferences";

export type { OnboardingPreferences, OnboardingPreferencesPatch };

export async function getOnboardingPreferences(
  db: SupabaseClient,
  userId: string
): Promise<OnboardingPreferences> {
  const { data, error } = await db
    .from("user_preferences")
    .select("onboarding")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`[onboarding] load failed: ${error.message}`);
  }
  if (!data) return defaultOnboardingPreferences();
  return parseOnboardingPreferences(data.onboarding);
}

export async function patchOnboardingPreferences(
  db: SupabaseClient,
  userId: string,
  patch: OnboardingPreferencesPatch
): Promise<OnboardingPreferences> {
  const current = await getOnboardingPreferences(db, userId);
  const next = mergeOnboardingPatch(current, patch);
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await db
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`[onboarding] lookup failed: ${lookupErr.message}`);
  }

  const { error } = existing
    ? await db
        .from("user_preferences")
        .update({ onboarding: next, updated_at: now })
        .eq("user_id", userId)
    : await db.from("user_preferences").insert({
        user_id: userId,
        onboarding: next,
        updated_at: now,
      });

  if (error) {
    throw new Error(`[onboarding] save failed: ${error.message}`);
  }
  return next;
}

/** Replace onboarding blob with defaults (debug / QA reset). */
export async function resetOnboardingPreferences(
  db: SupabaseClient,
  userId: string
): Promise<OnboardingPreferences> {
  const next = defaultOnboardingPreferences();
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await db
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`[onboarding] lookup failed: ${lookupErr.message}`);
  }

  const { error } = existing
    ? await db
        .from("user_preferences")
        .update({ onboarding: next, updated_at: now })
        .eq("user_id", userId)
    : await db.from("user_preferences").insert({
        user_id: userId,
        onboarding: next,
        updated_at: now,
      });

  if (error) {
    throw new Error(`[onboarding] reset failed: ${error.message}`);
  }
  return next;
}
