export type DirectionLockGenerationCommitSource = "intent_agent" | "direction_lock_ui";

export type DirectionLockGenerationCommitValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION"
        | "CONFIRMED_SITE_OUTLINE_REQUIRED";
      message: string;
    };

/** Server-side authority for which path may enqueue generation while direction lock is enabled. */
export function validateDirectionLockGenerationCommit(input: {
  directionLockEnabled: boolean;
  source: DirectionLockGenerationCommitSource;
  hasConfirmedSiteOutline: boolean;
}): DirectionLockGenerationCommitValidation {
  if (!input.directionLockEnabled) return { ok: true };

  if (input.source !== "direction_lock_ui") {
    return {
      ok: false,
      code: "DIRECTION_LOCK_REQUIRES_UI_CONFIRMATION",
      message: "Direction lock requires confirmation from the Studio direction panel.",
    };
  }

  if (!input.hasConfirmedSiteOutline) {
    return {
      ok: false,
      code: "CONFIRMED_SITE_OUTLINE_REQUIRED",
      message: "Direction lock requires a valid confirmedSiteOutline.",
    };
  }

  return { ok: true };
}
