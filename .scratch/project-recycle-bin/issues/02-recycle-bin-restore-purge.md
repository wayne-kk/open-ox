# 02 — Recycle Bin: list + restore + permanent delete

Status: done

## Parent

`.scratch/project-recycle-bin/PRD.md`

## What to build

Add a Workspace Recycle Bin surface where the owner can see trashed projects (name, trashed time, whether 30-day auto-purge is scheduled / when it expires). From there: **restore** returns the project to the active Workspace without turning Publish Preview back on; **permanent delete** hard-removes the DB row and cleans site/storage after a clear confirmation. Wire restore and permanent-delete through the project lifecycle seam and owner-authenticated APIs.

## Acceptance criteria

- [x] Owner can open a Recycle Bin view listing only their trashed projects
- [x] List shows trash time and auto-purge status (`purge_after` or “no auto-purge”)
- [x] Restore clears trash fields, returns project to Workspace lists, leaves Publish Preview / Allow Remix off
- [x] Folder association is preserved on restore when still valid
- [x] Permanent delete requires confirmation and performs today’s hard-delete cleanup (DB + site + storage)
- [x] Permanent delete is only for already-trashed projects (or equivalent safe guard)
- [x] Lifecycle tests cover restore (no re-publish) and permanent delete behavior at the seam

## Blocked by

- `01-trash-soft-delete-auto-unlist`
