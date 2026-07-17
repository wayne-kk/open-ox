# 01 — Trash path: soft delete + auto-unlist + 30-day checkbox

Status: done

## Parent

`.scratch/project-recycle-bin/PRD.md`

## What to build

Change Workspace “delete project” from hard delete to Recycle Bin (soft delete) end-to-end. Confirming delete sets trash state, clears Publish Preview and Allow Remix so the project leaves Community immediately, stops preview/dev server, and does **not** remove site/storage files. The confirm dialog explains Recycle Bin recovery and includes a default-checked checkbox「30 天后自动永久删除」that sets or clears the auto-purge schedule. Active Workspace lists (and other owner list callers via the same list seam) omit trashed projects; Community listing excludes trashed rows even if publish flags were wrong.

## Acceptance criteria

- [x] Schema supports `deleted_at` and `purge_after` on projects, with indexes suitable for trash lists and purge sweeps
- [x] Project DELETE (owner path) trashes instead of hard-deleting; site/storage files remain
- [x] Trash clears Publish Preview and Allow Remix in the same update
- [x] Checkbox on → `purge_after` ≈ trash time + 30 days; checkbox off → `purge_after` null
- [x] Workspace / owner project lists default to non-trashed only (Feishu and gallery included via list seam)
- [x] Community list never returns trashed projects
- [x] Delete confirm copy describes Recycle Bin; checkbox「30 天后自动永久删除」defaults checked
- [x] Lifecycle seam tests cover trash + publish flags + list filters + purge_after on/off

## Blocked by

None - can start immediately
