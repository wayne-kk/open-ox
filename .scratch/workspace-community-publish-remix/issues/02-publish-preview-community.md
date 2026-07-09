# 02 — Publish Preview + Community static preview

Status: done

## Parent

`.scratch/workspace-community-publish-remix/PRD.md`

## What to build

Add Publish Preview as an author opt-in. When on (and a usable static preview already exists), the project appears on `/community` for anyone (including anonymous) and non-owners may open the static preview. While on, newer successful builds refresh what Community shows. Turning off unlists immediately and revokes non-owner preview access. Expose the toggle in Studio (primary) and `/projects` card menu. Reserve schema for unlisted listing without shipping unlisted UI.

## Acceptance criteria

- [x] Author can enable Publish Preview only when a usable static preview exists
- [x] `/community` lists only projects with Publish Preview on; anonymous can browse and open static preview
- [x] Disabling Publish Preview removes the project from Community and non-owner preview URLs fail
- [x] Studio publish panel and `/projects` card menu can toggle Publish Preview / Allow Remix
- [x] Schema reserves unlisted; UI does not expose it
- [x] Migration defaults all existing projects to Publish Preview off

## Blocked by

- `01-workspace-owner-only`

## Notes

- Migration `025_publish_preview_remix.sql`
- APIs: `/api/community/projects`, PATCH publish fields on `/api/projects/[id]`
