# 04 — Admin all-projects + force unlist

Status: done

## Parent

`.scratch/workspace-community-publish-remix/PRD.md`

## What to build

Restore an **internal** Admin all-projects view (not mixed into `/community` or normal `/projects`) for support and moderation. Admin can force-disable Publish Preview (which also clears Allow Remix).

## Acceptance criteria

- [x] Admin-only UI lists all projects with owner and publish/remix state
- [x] Admin can force-unlist a Community project
- [x] Force-unlist does not delete the author’s project
- [x] Non-admin users have no access to this surface or its APIs

## Blocked by

- `02-publish-preview-community`

## Notes

- `/admin/projects`, `/api/admin/projects`, `/api/admin/projects/[id]/unlist`
