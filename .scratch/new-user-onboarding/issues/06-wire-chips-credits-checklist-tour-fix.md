# 06 — Wire chips/credits + restore checklist; fix ProductTour lifecycle

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

Close the gaps left after the ProductTour overlay landed on top of unfinished v0.1 surfaces:

1. **Example brief chips + Credits soft promise** on marketing `HeroPrompt` and logged-in Workspace empty (fill prompt; fire `onboarding_chip_click`).
2. **Studio non-blocking 2-step checklist + Design tip** using existing i18n keys; auto Design Mode + Direct Apply completion unchanged.
3. **Split tour from task chrome**: add `tourSeen` (or equivalent) so ProductTour is optional/first-run and does not share dismiss/complete with the 2-step lesson.
4. **ProductTour UX**: spotlight hole click-through (do not dismiss on hole click); tour complete/skip marks tour seen only — **never** emit `onboarding_design_complete` except on successful Direct Apply.

## Acceptance criteria

- [x] HeroPrompt (marketing + Workspace empty) shows 4–5 curated chips; click fills textarea + `onboarding_chip_click`
- [x] Logged-in Workspace empty shows Credits soft-promise copy
- [x] Studio shows non-blocking 2-step bar + Design tip when task chrome should show
- [x] Tour open ≠ task chrome open; finishing/skipping tour does not set `designModeDone` and does not fire `onboarding_design_complete`
- [x] Spotlight hole does not dismiss tour; clicks can reach the target (or at least do not call dismiss)
- [x] `onboarding_design_complete` only from Direct Apply success path
- [x] Unit tests: visibility helpers for tour vs checklist; tourSeen merge

## Blocked by

None

## Answer

Shipped:

- `tourSeen` + `shouldShowProductTour` in prefs seam; API accepts `tourSeen`
- `ExampleBriefChips` on `HeroPrompt`; Workspace empty passes `showCreditsPromise`
- `StudioOnboardingChecklist` non-blocking in Studio
- ProductTour four-panel dim + hole click-through; complete/skip only `tourSeen`
- `onboarding_design_complete` only in `handleDirectPatchSuccess`
