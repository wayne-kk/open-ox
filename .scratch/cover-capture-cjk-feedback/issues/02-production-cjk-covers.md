# 02 — Production covers render CJK (no tofu)

Status: done

## Parent

`.scratch/cover-capture-cjk-feedback/PRD.md`

## What to build

Make production cover capture render Chinese (and Latin fallback) correctly: bake Noto fonts and Playwright Chromium into the production image (browser installed at build time into `/ms-playwright`, OS libs + fonts on the runner, readable by the `nextjs` user). When capturing, after navigation `load`, wait for `document.fonts.ready` with a ~5s fail-open timeout, then a short ~300–500ms settle, then shoot the home viewport. Demo: rebuild the production image, capture a Chinese preview, open the cover—glyphs are readable, not tofu boxes.

## Acceptance criteria

- [x] Production runner image includes `fonts-noto-core` and `fonts-noto-cjk` (or equivalent that provides Noto CJK)
- [x] Playwright Chromium is installed at build time into `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and available to the non-root app user at runtime (with required OS dependencies on the runner)
- [x] Cover screenshot wait is `fonts.ready` (≤ ~5s fail-open) + short settle; the old ~1.2s blind sleep is no longer the primary gate
- [x] Shared launch helper from slice 01 is used for cover capture
- [ ] Operator smoke after image rebuild: a Chinese home viewport cover shows readable CJK (manual/script; not required in default CI)

## Blocked by

- `01-shared-chromium-launch`
