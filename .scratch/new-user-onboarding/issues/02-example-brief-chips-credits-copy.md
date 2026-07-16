# 02 — Example brief chips + Credits soft promise

Status: resolved

## Parent

`.scratch/new-user-onboarding/PRD.md`

## What to build

On the marketing homepage and Workspace empty prompt, add **4–5 curated example brief chips** (zh + en i18n) that write into the existing prompt input on click. On the **logged-in** Workspace empty state, show the welcome Credits **soft promise** (≈ one full generate and a few edits; actual usage may vary). Fire `onboarding_chip_click` on chip select. Do **not** mention Remix. Chips complement rotating placeholders; they do not replace them.

## Acceptance criteria

- [x] Marketing `HeroPrompt` shows 4–5 example brief chips; click fills the prompt textarea with that brief
- [x] Workspace empty state shows the same chips (same copy source / i18n keys)
- [x] Logged-in Workspace empty state shows Credits soft-promise copy aligned with welcome 12 policy
- [x] Chip click emits `onboarding_chip_click` via existing analytics client
- [x] No Remix CTA or Remix wording in this surface
- [x] zh + en strings for briefs and soft promise

## Blocked by

None - can start immediately (parallel with 01)

## Answer

Implemented in new-user-onboarding v0.1 ship (prefs seam, chips, Studio checklist/Design tip, chapter titles, analytics).
