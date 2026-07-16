# 05 — Deep activation observe: `first_modify_send`

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

Observe deep activation without onboarding UI: on a user’s **first** Modify send, emit `first_modify_send` exactly once (idempotent via preference flag or equivalent). No tip, checklist step, or nudge toward Modify.

## Acceptance criteria

- [x] First Modify send for a user emits `first_modify_send` once
- [x] Subsequent Modify sends do not re-emit
- [x] No Modify onboarding chrome, toast, or checklist step
- [x] Persistence survives refresh / new device (server-side, consistent with onboarding prefs seam)

## Blocked by

- `.scratch/new-user-onboarding/issues/01-prefactor-onboarding-preferences.md`

## Answer

Implemented in new-user-onboarding v0.1 ship (prefs seam, chips, Studio checklist/Design tip, chapter titles, analytics).
