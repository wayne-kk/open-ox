# ADR-0002: Workspace private by default; Community via Publish Preview; Remix as separate copy license

**Date**: 2026-07-09  
**Status**: Accepted  
**Context**: Project list / visibility / community discovery

## Decision

1. **Default visibility is owner-only.** Unlisted projects are invisible to other users (including authenticated members). The legacy authenticated global gallery (`/projects` “全部成员”) is removed from the product surface.
2. **Publish Preview and Allow Remix are independent axes**, with a product dependency: Allow Remix may only be on when Publish Preview is on; turning Publish Preview off clears Allow Remix. Community listing requires Publish Preview. Remix remains the future monetization seam (copy license), not Publish Preview.
3. **Community preview is static only** (existing `site-previews` pipeline). Non-owners never enter Studio for someone else’s project; to edit, they Remix.
4. **Remix** copies the latest site source snapshot (+ display metadata + lineage), excludes secrets (e.g. `.env*`), does **not** copy Studio chat/agent traces, creates a new owner project, and does not grant the original author control over the copy. Closing Publish Preview or deleting the source unlists immediately; existing remixes remain.
5. **Migration**: all existing projects become private; authors must re-enable Publish Preview (remix defaults off). Unpublished preview/cover URLs are denied to non-owners.
6. **Admin** keeps an internal all-projects view and can force-unlist (same state machine as author off); this is not part of `/community` or normal `/projects`.

## Considered options (rejected)

- Keep internal global gallery + add Community as a second surface — makes “publish” meaningless for members.
- Single “publish to community” switch that always enables remix — blocks preview-only sharing and future remix pricing.
- Unlisted preview links / live preview / read-only Studio in MVP — deferred; schema may reserve unlisted later.
- Auto-list projects that already have static previews — would publish without author consent.

## Consequences

- RLS / list APIs must stop “any authenticated user reads all projects”; community reads are scoped to Publish Preview.
- Preview and cover routes must gate on Publish Preview (or owner/admin), not merely on object existence in storage.
- Studio and mutate routes must enforce ownership (or explicit future collaborator model); “logged in + project exists” is insufficient.
- Product surfaces split: `/projects` (mine) vs `/community` (listed). Remix UX lands in the remixer’s Studio with lineage (`remixed_from` + author/title snapshots).

## References

- `docs/research/lovable-community-publish-remix-20260709.md`
- `docs/product/workspace-community-publish-remix-v0.1.md`
- Grilling session 2026-07-09 (decisions locked)