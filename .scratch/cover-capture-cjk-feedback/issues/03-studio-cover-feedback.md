# 03 — Studio cover-capture feedback

Status: done

## Parent

`.scratch/cover-capture-cjk-feedback/PRD.md`

## What to build

Make manual cover update in Studio responsive and truthful end-to-end: scheduling returns `queued` vs `in_flight` with `baselineUpdatedAt`; auto and manual capture share the same gate (in-memory in-flight **or** DB `pending` newer than 3 minutes). Manual API maps queued → 202 and in-flight → 409. Studio keeps the control busy, polls project cover fields every 2s for up to 3 minutes, treats both 202 and 409 as “wait for this job,” and finishes only when `ready` with a strictly newer `coverImageUpdatedAt` than the baseline (or `failed` with a truncated error hint; timeout hint if still unresolved).

## Acceptance criteria

- [x] Manual schedule API returns `baselineUpdatedAt` on both 202 (`QUEUED`) and 409 (`COVER_CAPTURE_IN_FLIGHT`)
- [x] In-flight = process set **or** fresh `pending` (≤ 3 minutes); expired `pending` allows a new run
- [x] Auto post-generation/modify capture uses the same gate and skips silently when in flight
- [x] Studio polls ~2s / ~3min; success requires `ready` and newer `coverImageUpdatedAt` than baseline; failure shows truncated `coverImageError`
- [x] 409 starts the same wait loop with an “already capturing” style hint
- [x] Unit tests cover orchestration queue/in-flight/freshness and poll completion rules at the lib seam (no CI Chromium glyph tests)

## Blocked by

None - can start immediately
