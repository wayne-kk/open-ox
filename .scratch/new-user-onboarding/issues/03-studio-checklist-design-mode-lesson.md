# 03 — Studio two-step checklist + Design Mode first lesson

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

In Studio, for users whose onboarding chrome should show, ship the **2-step progress bar** (① previewable generate done ② Design Mode Direct Apply once) with **「不再显示」**. When preview first becomes ready while onboarding is active: mark `generateDone`, **auto-enable Design Mode**, and show a **non-blocking** tip that the user can click any text to edit. Any successful Direct Apply marks `designModeDone` and completes onboarding chrome. If `directEditCapable=false`, explain that pick-edit is unavailable without redefining complete as preview-only. Wire funnel events: `onboarding_step_view`, `onboarding_generate_preview_ready`, `onboarding_design_complete`, `onboarding_dismiss`.

## Acceptance criteria

- [x] Studio shows 2-step chrome only when preference seam says onboarding should show
- [x] Previewable ready → `generateDone` persisted; Design Mode auto-enabled; non-blocking tip visible
- [x] Successful Direct Apply → `designModeDone` persisted; steps/tip hide as complete
- [x] 「不再显示」 sets `dismissed` and never shows chrome again for that user
- [x] `directEditCapable=false`: step 2 explains unavailable pick-edit; does not auto-set `designModeDone`
- [x] Events fire: `onboarding_step_view` (with step id), `onboarding_generate_preview_ready`, `onboarding_design_complete`, `onboarding_dismiss`
- [x] No Modify nudge UI

## Blocked by

- `.scratch/new-user-onboarding/issues/01-prefactor-onboarding-preferences.md`

## Answer

Implemented in new-user-onboarding v0.1 ship (prefs seam, chips, Studio checklist/Design tip, chapter titles, analytics).
