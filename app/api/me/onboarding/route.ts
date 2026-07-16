import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  isOnboardingResetRequest,
  parseOnboardingPatch,
} from "@/lib/onboarding/onboardingPreferences";
import {
  getOnboardingPreferences,
  patchOnboardingPreferences,
  resetOnboardingPreferences,
} from "@/lib/onboarding/preferences";

export const runtime = "nodejs";

/** GET /api/me/onboarding — current onboarding prefs (defaults if missing). */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const onboarding = await getOnboardingPreferences(session.supabase, session.user.id);
    return NextResponse.json({ onboarding });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}

/**
 * PATCH /api/me/onboarding
 * Body: partial flags, or `{ "reset": true }` to wipe progress (debug gate).
 */
export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    if (isOnboardingResetRequest(body)) {
      const onboarding = await resetOnboardingPreferences(session.supabase, session.user.id);
      return NextResponse.json({ onboarding, reset: true });
    }

    const patch = parseOnboardingPatch(body);
    if (!patch) {
      return NextResponse.json(
        {
          error:
            "Body must include { reset: true } or at least one boolean: dismissed, generateDone, designModeDone, firstModifySendDone, tourSeen, workspaceTourSeen",
          code: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    const onboarding = await patchOnboardingPreferences(
      session.supabase,
      session.user.id,
      patch
    );
    return NextResponse.json({ onboarding });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}
