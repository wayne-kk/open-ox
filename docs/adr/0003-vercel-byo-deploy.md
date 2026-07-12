# ADR-0003: BYO Vercel OAuth + static one-click Deploy

**Date**: 2026-07-12  
**Status**: Accepted  
**Context**: User-facing production deploy for generated sites (product outline A1)

## Decision

1. **Bring-your-own Vercel only.** Generated sites deploy into the user’s Vercel account/billing. Open-OX does not host user production sites on a shared Vercel team.
2. **Vercel Integration OAuth** (not PAT paste; not Sign-in-with-Vercel identity scopes alone). Tokens are encrypted at rest (`VERCEL_TOKEN_ENCRYPTION_KEY`) and never returned to the browser.
3. **Static artifact deploy.** Open-OX runs `next build` **without** `OPEN_OX_STATIC_BASE_PATH`, then uploads `out/` via Vercel Files + Deployments APIs. This is separate from Storage preview sync (`/site-previews/{id}` with basePath).
4. **Auto-create + persistent bind.** First Deploy creates a Vercel project under the user’s default team; later Deploys reuse that project. MVP does not “link existing” Vercel projects.
5. **Publish Preview ≠ Deploy.** Community Publish Preview (ADR-0002) remains a discovery/static-preview axis. Deploy is a separate Studio CTA and Integrations settings surface.
6. **Manual async Deploy.** User clicks Deploy; API enqueues and polls status (`queued|building|uploading|ready|error`). No auto-deploy after generation; no Open-OX credits charged for Deploy.
7. **Disconnect is local-only.** Clearing the connection deletes Open-OX tokens and project bindings; it never deletes remote Vercel projects.
8. **Deferred:** GitHub sync, custom domains, platform-hosted Vercel, link-existing project, deploy history timeline, auto-deploy.

## Consequences

- Requires env: `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`, `VERCEL_TOKEN_ENCRYPTION_KEY`, preferably `VERCEL_INTEGRATION_SLUG`, optional `VERCEL_REDIRECT_URI`.
- New tables: `user_vercel_connections`, `project_vercel_deployments` (service-role writes for secrets).
- UI: `/settings/integrations` for Connect/Disconnect/team; Studio **Deploy** menu for actions.
- Production static builds must not reuse preview `out/` stamped with `/site-previews/...` basePath.

## References

- Grilling session 2026-07-11 / 2026-07-12 (decisions locked)
- ADR-0002 (Publish Preview boundary)
- `docs/product-iteration-outline.md` (A1 一键部署)
