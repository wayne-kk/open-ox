# 01 — Prefactor: shared Chromium launch

Status: done

## Parent

`.scratch/cover-capture-cjk-feedback/PRD.md`

## What to build

Extract a single Chromium launch helper for cover capture and external reference-page capture. Callers share executable-path env handling and non-root sandbox args so Docker/non-root runs do not fail only on one path. Behavior of what page is captured and when the screenshot fires stays unchanged in this slice.

## Acceptance criteria

- [x] Cover capture and reference-page capture both launch Chromium through the shared helper
- [x] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is still honored when set
- [x] Non-root processes get `--no-sandbox` / `--disable-setuid-sandbox` (minimal set); root/local default sandbox behavior stays as today unless non-root
- [x] Existing capture flows still produce a screenshot when Chromium was already working on the machine

## Blocked by

None - can start immediately
