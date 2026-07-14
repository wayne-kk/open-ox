# 02 — Studio: set Feishu active project

Status: resolved

## Parent

`.scratch/feishu-modify-mvp/PRD.md`

## What to build

Let the project owner mark the **current Studio project** as their Feishu active project (and clear it). Persist a per-user pointer to an owned project id. Expose read/write so the future Bot can show `/status` and reject Modify when unset. UI lives in Studio (project chrome / menu)—not a separate Feishu settings page and not the Workspace list in this slice.

## Acceptance criteria

- [x] In Studio, owner can set “Feishu current project” for the open project
- [x] Owner can clear the active project
- [x] Persistence survives reload; reading back returns the same project id (or empty)
- [x] Setting another project moves the pointer (only one active project per user)
- [x] Non-owners cannot set active project on someone else’s project
- [x] Tests or API-level checks cover set / clear / switch / ownership deny

## Blocked by

None - can start immediately

## Answer

- Migration `030_user_feishu_settings.sql` (`active_project_id`, `feishu_open_id`).
- `lib/feishu/activeProject.ts` + `GET/PUT /api/feishu/active-project`.
- Studio: `StudioFeishuActiveButton` in Studio header.
- Feishu login callback best-effort `linkFeishuOpenId` for Bot identity.
