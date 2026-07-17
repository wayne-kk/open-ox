# Project Recycle Bin + Auto-Unpublish

Status: ready-for-agent

## Problem Statement

Deleting a project today is a hard delete: the `projects` row is removed and site/storage files are cleaned up immediately. Users have no way to recover from accidental deletes. Separately, Community visibility is tied to Publish Preview on the same project row — any soft-delete design must guarantee that a deleted project leaves Community immediately (auto cancel Publish Preview / Allow Remix), matching ADR-0002’s “unlists immediately” intent even when the row is retained for recovery.

## Solution

Replace hard delete as the default Workspace “delete” action with a Recycle Bin (soft delete). Moving a project to the Recycle Bin clears Publish Preview and Allow Remix so it disappears from Community at once. Site source and storage stay until permanent deletion. Users can restore from the Recycle Bin (without re-publishing), permanently delete, or opt into automatic permanent deletion after 30 days via a checkbox on the delete confirmation dialog (default on).

## User Stories

1. As a project owner, I want “delete” to move the project to a Recycle Bin instead of destroying it immediately, so that I can undo mistakes.
2. As a project owner, I want a confirmation dialog before a project leaves my Workspace list, so that I do not trash by accident.
3. As a project owner, I want the delete confirmation to explain that the project goes to the Recycle Bin, so that I understand it is recoverable.
4. As a project owner, I want a checkbox “30 天后自动永久删除” on the delete confirmation (default checked), so that I can choose whether trash is time-limited.
5. As a project owner, I want to uncheck that checkbox, so that the project stays in the Recycle Bin until I permanently delete it myself.
6. As a project owner, I want checking the 30-day option to schedule permanent deletion ~30 days after trash time, so that old trash does not accumulate forever.
7. As a project owner, I want a published-to-Community project to leave Community immediately when I trash it, so that others cannot keep discovering or opening its static preview.
8. As a project owner, I want Allow Remix to turn off when I trash a project, so that new Remixes cannot start from a trashed source.
9. As a Community visitor, I want trashed projects never to appear in Community, so that discovery only shows live Publish Preview projects.
10. As a non-owner, I want static preview / cover access denied for trashed projects, so that soft-delete is not a loophole around private Workspace.
11. As a remixer of a previously remixed project, I want my Remix copy to keep working after the source is trashed, so that lineage copies stay independent (ADR-0002).
12. As a project owner, I want trashed projects hidden from the normal Workspace list (folders included), so that day-to-day work only shows active projects.
13. As a project owner, I want a Recycle Bin entry in Workspace, so that I can find trashed projects in one place.
14. As a project owner, I want the Recycle Bin to show project name and when it was trashed, so that I can identify what to restore.
15. As a project owner, I want the Recycle Bin to show whether 30-day auto-purge is scheduled and roughly when it expires, so that I know how long I have.
16. As a project owner, I want to restore a project from the Recycle Bin, so that it returns to my Workspace.
17. As a project owner, I want restore to clear trash state without turning Publish Preview back on, so that re-listing to Community stays an explicit opt-in.
18. As a project owner, I want a restored project to keep its folder association when still valid, so that organization is preserved when possible.
19. As a project owner, I want to permanently delete a project from the Recycle Bin, so that I can destroy it and its files when I am sure.
20. As a project owner, I want permanent delete to require a clear confirmation, so that I do not wipe recovery by accident.
21. As a project owner, I want permanent delete to remove the database project and clean site/storage artifacts, so that “gone” means gone.
22. As a system, I want a scheduled job to permanently delete trash items whose auto-purge time has passed, so that the 30-day checkbox is honored without manual action.
23. As a project owner, I want opening Studio (or other mutate surfaces) for a trashed project to fail closed, so that trash is not an editable back door.
24. As an admin viewing all projects, I want trashed projects either labeled or filterable, so that support can tell active from trash (without treating trash as Community-listed).
25. As a project owner, I want Feishu / other “list my projects” surfaces to omit trashed projects by default, so that bots and side channels match Workspace.
26. As a project owner, I want Deploy / Vercel bindings not to be the Recycle Bin’s job to tear down on soft delete, so that restore can still use existing BYO deploy setup until permanent delete (or existing disconnect rules apply separately).
27. As a product, I want soft delete to stop any running preview/dev server for that project, so that trashed projects do not keep burning preview resources.
28. As a project owner, I want copy in the delete dialog and Recycle Bin to use “回收站 / Recycle Bin” and “永久删除”, so that hard delete is not confused with trash.
29. As a project owner, I want Credits / generation history semantics unchanged except that trashed projects are inactive, so that billing is not reinvented by this feature.
30. As an implementing agent, I want one lifecycle seam in project management to own trash / restore / purge / list filters, so that Community and Workspace cannot drift on visibility rules.

## Implementation Decisions

- **Domain vocabulary**: Use Workspace, Community, Publish Preview, Allow Remix, Remix, Remix lineage as in `CONTEXT.md`. Prefer “Recycle Bin / 回收站”, “trash / soft delete”, “restore”, “permanent delete / purge”. Do not invent a separate “Community post” entity — visibility remains Publish Preview (+ listing) on the project.
- **Respect ADR-0002**: Trashing must unlist immediately (clear Publish Preview and Allow Remix). Existing Remix copies remain; source lineage FK behavior on eventual permanent delete stays `ON DELETE SET NULL` as today.
- **Default delete path changes from hard delete to soft delete.** Permanent delete remains available from the Recycle Bin (and via the 30-day auto-purge path).
- **Schema (projects)**:
  - `deleted_at` timestamptz null — null means active; non-null means in Recycle Bin.
  - `purge_after` timestamptz null — when set, system may permanently delete once `now() >= purge_after`; when null, no auto-purge (manual permanent delete only).
  - Indexes suitable for owner trash lists and purge sweeps (`deleted_at`, `purge_after` where not null).
- **Trash (= soft delete) behavior** (single lifecycle operation):
  - Require owner (or existing admin override rules consistent with current DELETE).
  - Set `deleted_at = now()`.
  - If the delete confirmation’s “30 天后自动永久删除” checkbox is checked (default **true**), set `purge_after = deleted_at + 30 days`; if unchecked, set `purge_after = null`.
  - Set `publish_preview = false` and `allow_remix = false` in the same update (auto cancel Community publish).
  - Stop preview/dev server for the project (same idea as today’s DELETE pre-step).
  - Do **not** delete site directory or object-storage project files on trash.
- **Restore**:
  - Clear `deleted_at` and `purge_after`.
  - Do **not** set Publish Preview or Allow Remix back to true.
  - Project reappears in Workspace lists; Community stays off until the owner publishes again.
- **Permanent delete (purge)**:
  - Equivalent to today’s hard delete: remove DB row, remove site dir, remove storage files; cascades/tags/runs behave as today.
  - Allowed for owner on already-trashed projects; purge job only targets rows with non-null `purge_after` that are due.
- **List filters**:
  - Workspace owner lists / gallery / Feishu project lists: default `deleted_at IS NULL`.
  - Recycle Bin list: owner’s projects with `deleted_at IS NOT NULL`.
  - Community list and any non-owner discovery: must exclude trashed rows (`deleted_at IS NULL`) in addition to Publish Preview + listed — belt and suspenders with the auto-unlist on trash.
- **API shape** (contracts, not paths carved in stone):
  - Existing project DELETE becomes trash (soft delete), accepting whether 30-day auto-purge is enabled (from the checkbox).
  - Restore endpoint for a trashed project.
  - Permanent-delete endpoint (or DELETE with explicit purge flag) for trashed projects only.
  - Recycle Bin listing via existing summary list options or a dedicated query flag on the project-manager list seam.
- **UI**:
  - Workspace delete confirmation: copy that the project moves to Recycle Bin; checkbox **「30 天后自动永久删除」** default checked; confirm performs trash with the chosen `purge_after` policy.
  - Workspace Recycle Bin surface: list trashed projects; actions Restore and Permanent delete (with confirm).
  - Show remaining time / purge date when `purge_after` is set; show that auto-purge is off when null.
- **Studio / mutate routes**: Treat trashed projects as not found or not editable for normal owner Studio flows (fail closed). Restore is the path back to editing.
- **Admin**: Do not list trashed projects in Community. Admin all-projects may show trash state; force-unlist remains the Publish Preview off path and is largely redundant after trash but must not re-publish trash.
- **Purge job**: A server-side scheduled sweep permanently deletes due trash (`deleted_at IS NOT NULL AND purge_after IS NOT NULL AND purge_after <= now()`). Idempotent; safe to re-run. Exact scheduler hook follows existing repo cron/job patterns if present; otherwise a minimal authenticated/internal sweep entry is acceptable for v1.
- **Primary module seam**: Project lifecycle in the project-manager module — trash, restore, permanent delete, and list filters (active vs trash vs community). Callers (HTTP routes, Workspace UI, Community, Feishu lists) go through this seam so visibility rules stay consistent.
- **Deploy (Vercel BYO)**: Soft delete does not delete remote Vercel projects (consistent with ADR-0003). Permanent delete may leave remote Vercel projects alone as today’s disconnect/delete semantics already do unless an existing cleanup already runs — do not expand Deploy scope in this PRD.

## Testing Decisions

- **Good tests** assert external lifecycle behavior only: after trash, active lists omit the project; Community visibility is off; restore returns it without Publish Preview; permanent delete removes it; `purge_after` is set or cleared according to the checkbox flag; due items are selected for purge. Do not assert React markup, SQL text, or storage SDK call shapes.
- **Module under test**: the project-manager lifecycle seam (trash / restore / purge selection / list filtering / publish flags on trash). Prefer a focused unit/integration test file beside that module with a fake/mocked DB client, matching other `lib/*.test.ts` style in the repo.
- **Prior art**: Community access tests around Publish Preview gating (`staticSitePreviewProxyAccess`-style); publish settings helpers; Feishu list mocks that stub `listProjectsSummary`. Extend the same “list + visibility flags” style rather than browser e2e for v1.
- **Minimum cases**:
  1. Trash with auto-purge on → `deleted_at` set, `purge_after` ~+30d, Publish Preview and Allow Remix false.
  2. Trash with auto-purge off → `deleted_at` set, `purge_after` null, publish flags false.
  3. Active Workspace list excludes trashed; Recycle Bin list includes them.
  4. Community-listed query never returns trashed rows.
  5. Restore clears trash fields and leaves Publish Preview false.
  6. Permanent delete path still performs hard removal (behavior-level with mocked DB/storage as feasible).
  7. Purge sweep selects only due `purge_after` rows.

## Out of Scope

- Multi-select bulk trash/restore/purge in v1 (single-project actions are enough).
- Per-folder Recycle Bin; one owner-level Recycle Bin is enough.
- Soft-delete for folders (folder dissolve stays as today).
- Changing Remix economics, Credits, or Deploy remote teardown.
- Unlisted preview links / share tokens for trashed projects.
- Legal hold / admin “quarantine” distinct from owner Recycle Bin.
- Migrating already hard-deleted historical projects (impossible); only future deletes use trash.
- New ADR unless implementation needs a durable decision beyond ADR-0002; if written, it should only record soft-delete + 30-day purge checkbox semantics.

## Further Notes

- Today’s `DELETE /api/projects/:id` hard-deletes then cleans storage; product copy and docs that say “删除项目及文件” must be updated to distinguish Recycle Bin vs permanent delete.
- Belt-and-suspenders: even if a bug left `publish_preview = true` on a trashed row, Community and non-owner preview must still exclude `deleted_at IS NOT NULL`.
- Checkbox default **on** matches “most deletes should not linger forever”; unchecking is the escape hatch for “keep until I decide”.
- Confirmed test seam with requester: one lifecycle seam in project-manager; 30-day auto-delete checkbox on delete confirmation included by request.
