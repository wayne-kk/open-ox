# 03 — Fail-closed: Studio / mutate / non-owner preview on trashed

Status: done

## Parent

`.scratch/project-recycle-bin/PRD.md`

## What to build

Ensure a trashed project cannot be edited or used as a back door. Owner Studio and other mutate surfaces fail closed for trashed projects (not found / not editable). Non-owner static preview, cover, and similar Community access deny trashed projects even if stale Publish Preview flags remained. Restore remains the only path back to editing.

## Acceptance criteria

- [x] Opening Studio (or equivalent mutate entry) for a trashed project fails closed for the owner
- [x] Mutating APIs for a trashed project reject (consistent with ownership + trash rules)
- [x] Non-owner static preview / cover access denies trashed projects
- [x] Active (non-trashed) owner access and Community Publish Preview behavior for live projects remain unchanged
- [x] Tests or existing preview-gate style coverage assert trashed ⇒ denied for non-owner paths

## Blocked by

- `01-trash-soft-delete-auto-unlist`
