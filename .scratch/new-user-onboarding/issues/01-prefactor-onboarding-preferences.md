# 01 — Prefactor: user onboarding preferences seam

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

Add a minimal **user-scoped** onboarding preference store and a small seam so later slices can read/write dismiss / step completion without inventing ad-hoc flags. Persist per `user_id`: `dismissed`, `generateDone`, `designModeDone`. Expose authenticated read/update and pure helpers for visibility (`shouldShowOnboarding` / completion merge). No product chrome in this slice—verify via API + unit tests.

## Acceptance criteria

- [x] Preference shape exists server-side for the signed-in user (idempotent read defaults when missing)
- [x] Authenticated GET/PATCH (or equivalent) can load and update the three flags without clobbering unrelated future prefs
- [x] Pure helper: UI chrome hidden when `dismissed` OR (`generateDone` AND `designModeDone`)
- [x] Updates are idempotent (setting `designModeDone` twice does not error or regress other flags)
- [x] Unit tests cover defaults, merge, and visibility rules
- [x] `CREDITS_ENABLED` / billing paths untouched

## Blocked by

None - can start immediately

## Answer

Implemented in new-user-onboarding v0.1 ship (prefs seam, chips, Studio checklist/Design tip, chapter titles, analytics).
