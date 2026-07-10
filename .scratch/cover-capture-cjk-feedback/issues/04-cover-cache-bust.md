# 04 — Workspace/Community cover cache bust

Status: done

## Parent

`.scratch/cover-capture-cjk-feedback/PRD.md`

## What to build

Make Workspace and Community cards show the current cover after a recapture: list/community payloads expose `coverImageUpdatedAt`; cards load `/api/projects/:id/cover?v=<updatedAt>` only (no signed `coverImageUrl` attachment for list display). Cover GET always proxies JPEG bytes with `Cache-Control: private, max-age=300`, and the old proxy-bytes env flag is removed. Demo: recapture a cover, reload the list—the card image updates without relying on a signed redirect cache.

## Acceptance criteria

- [x] Workspace and Community cards use versioned `/cover?v=` URLs; list/community APIs no longer attach signed cover URLs for `<img src>`
- [x] List/community responses include `coverImageUpdatedAt` when a cover exists (or enough to build `?v=`)
- [x] `GET` cover always returns JPEG bytes (no signed-URL redirect); `OPEN_OX_COVER_PROXY_BYTES` is removed
- [x] Cover responses use `Cache-Control: private, max-age=300`
- [x] Helper/list contract tests cover the URL/`?v=` behavior at the thin seam

## Blocked by

None - can start immediately
