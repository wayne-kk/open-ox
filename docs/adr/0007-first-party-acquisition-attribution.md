# ADR-0007: First-party first-touch acquisition attribution

**Date**: 2026-07-17  
**Status**: Accepted  
**Context**: Admin analytics needs “where did users come from?” without a third-party CDP. Behavioral events already live in `analytics_events`; marketing landing is SSG and logged-in users are redirected off `/` by `proxy`.

## Decision

1. **First-party only** — extend `lib/analytics` + Supabase; do not introduce PostHog/Segment for acquisition. Langfuse stays LLM observability only.
2. **First-touch** — capture UTM + `document.referrer` + landing path once in cookie `ox_acq` on first browser visit; never overwrite. Bind write-once into `user_acquisition` on auth success.
3. **Dimension table vs events** — durable per-user attribution lives in `user_acquisition`; `analytics_events` remains append-only behavior (events may carry acquisition properties for debugging).
4. **Channel** is derived at query time: any UTM → `utm`; else external referrer → `referral`; else `direct`; missing row → `unknown`.

## Consequences

- Capture must run on the first marketing hit (`AnalyticsProvider`), before auth redirect strips query params.
- Old users registered before this feature appear as `unknown` until they have no row (we do not backfill).
- Product channels (Remix / invite / Feishu) can later extend the same table without a second attribution stack.
