# 01 — Workspace owner-only + Studio/preview gate

Status: done

## What to build

Make Workspace private by default: `/projects` lists only the current user’s projects; remove the authenticated global “全部成员” gallery. Tighten Studio and mutate access to owners (admin exception for later admin slice). Deny non-owners (including anonymous) from static preview and cover URLs until Publish Preview exists (slice 02) — for this slice that means deny everyone except the owner.

Migrate existing projects to private semantics via RLS/list API changes (no auto-listing).

## Acceptance criteria

- [x] Authenticated `GET` project list defaults to the current user’s projects only; global member gallery UI and owner-filter-for-everyone are gone from `/projects`
- [x] User A cannot open User B’s Studio or successfully call mutate APIs on B’s project
- [x] Non-owner / anonymous requests to static preview and cover for a project are rejected (until Publish Preview)
- [x] Anonymous no longer receives a global “all projects” list from the workspace list API
- [x] Tests cover `projectAccess` helpers

## Blocked by

None - can start immediately

## Notes

- Migration `024_projects_select_owner_only.sql`
- Helper `lib/auth/projectAccess.ts`
