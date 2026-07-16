# 04 — Soft-gate skip clarity + human generate chapter titles

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

Keep the existing Intent / vibe clarification stack; add clear **recommend-but-skippable** soft-gate expression for first-time generate (no new calibration UI). During generate, surface **human-readable chapter titles** for pipeline steps (no mid-run preview flashes). When onboarding is still active, emit `onboarding_generate_started` on first generate start.

## Acceptance criteria

- [x] Soft gate reuses Intent + vibe picker; user can always skip to generate without a new dedicated calibration page
- [x] Copy/UI makes “recommended then skip” obvious for first-run users (without forcing hard gate)
- [x] Generate progress shows human chapter-style titles for visible pipeline steps
- [x] No mid-run preview flash / cinematic theater beyond titles
- [x] `onboarding_generate_started` fires once when generate starts while onboarding chrome is still active
- [x] No Remix mentions

## Blocked by

- `.scratch/new-user-onboarding/issues/01-prefactor-onboarding-preferences.md`

## Answer

Implemented in new-user-onboarding v0.1 ship (prefs seam, chips, Studio checklist/Design tip, chapter titles, analytics).
