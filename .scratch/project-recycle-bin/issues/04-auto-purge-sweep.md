# 04 — 30-day auto-purge sweep

Status: done

## Parent

`.scratch/project-recycle-bin/PRD.md`

## What to build

Add an idempotent server-side sweep that permanently deletes trashed projects whose `purge_after` is due (`deleted_at` set, `purge_after` not null, `purge_after <= now()`). Reuse the same permanent-delete lifecycle path as manual purge from the Recycle Bin so cleanup stays consistent. Hook scheduling to an existing cron/job pattern if present; otherwise a minimal authenticated/internal sweep entry is acceptable for v1.

## Acceptance criteria

- [x] Sweep selects only due auto-purge trash rows (not active projects, not trash with null `purge_after`, not future `purge_after`)
- [x] Each due row is permanently deleted via the same hard-delete cleanup as manual permanent delete
- [x] Sweep is idempotent and safe to re-run
- [x] Lifecycle / sweep selection tests cover due vs not-due cases
- [x] Scheduler or internal entry point exists so the job can run in deployed environments

## Blocked by

- `02-recycle-bin-restore-purge`
