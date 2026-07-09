# 03 — Allow Remix into Workspace

Status: done

## Parent

`.scratch/workspace-community-publish-remix/PRD.md`

## What to build

Add Allow Remix (depends on Publish Preview; turning preview off clears remix). Community shows Remix CTA when allowed; unauthenticated users are sent to login. Remix copies latest site source + display metadata + lineage, excludes secrets, does not copy Studio chat, creates a new owner project named like `原名 (Remix)`, and opens Studio with a short lineage hint.

## Acceptance criteria

- [x] Allow Remix can only be enabled while Publish Preview is on; disabling preview clears Allow Remix
- [x] Remix requires login + source Publish Preview + Allow Remix
- [x] Successful Remix creates a new Workspace project with lineage and opens Studio
- [x] Copied tree excludes configured secret patterns; chat is not copied
- [x] Copy-license short copy visible in publish UI

## Blocked by

- `02-publish-preview-community`

## Notes

- `lib/remixProject.ts`, `POST /api/projects/[id]/remix`
