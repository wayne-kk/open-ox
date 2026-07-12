# ADR-0004: Marketing SSG + SEO (locale-aware)

**Date**: 2026-07-12  
**Status**: Accepted  
**Context**: Speed and search discoverability for Open-OX marketing surfaces

## Decision

1. **SEO scope (phase 1)** is marketing only: `/`, `/home`, `/pricing`, `/changelog` (and English `/en…` equivalents). Studio, dashboard, community, docs, and user previews are out of scope for indexing work this round.
2. **Index whitelist**: sitemap includes `/`, `/pricing`, `/changelog` × `{zh-CN, en}`. `/home` is not listed; it sets `canonical` to the locale home (`/` or `/en`).
3. **Rendering**: marketing shells are **SSG**. Session must not run inside the `/` page component (cookies would force dynamic).
4. **Logged-in `/` redirect** lives in `proxy.ts`: only call `getUser()` when a Supabase auth cookie is present; on success redirect to locale `/dashboard`. `/home` stays available for signed-in marketing.
5. **robots.txt**: allow marketing paths; `Disallow` private/product prefixes (`/studio`, `/settings`, `/dashboard`, `/api`, `/admin`, …). Docs/community are not in sitemap and are not forcibly `noindex` yet.
6. **Metadata L2**: per-page localized title/description, `canonical`, `hreflang` (`zh-CN` / `en` / `x-default`), Open Graph + Twitter Card, shared static image `public/og/default.png`. No JSON-LD in this phase.
7. **Performance P1**: server-render static marketing copy; keep interactive islands client-side; defer WebGL (`GLSLHills`) until idle so LCP is not blocked.

## Considered options (rejected)

- Index community / docs / user previews in v1 — expands UGC and crawl budget risk.
- Full SSR for marketing — slower TTFB than SSG for mostly static copy.
- Always `getUser()` on `/` in proxy — taxes anonymous and crawler traffic.
- Dynamic `next/og` images — higher complexity; static brand OG is enough for L2.

## Consequences

- `app/[locale]/page.tsx` must stay free of `getSessionUser()`.
- `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_APP_URL`) must be set in production for correct absolute canonicals / sitemap / OG URLs.
- Future SEO for docs/community should extend sitemap + metadata without undoing the marketing SSG seam.

## References

- Grilling session 2026-07-12 (decisions locked)
- `lib/seo/marketingMetadata.ts`, `app/sitemap.ts`, `app/robots.ts`, `proxy.ts`
