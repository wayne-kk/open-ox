# 05 — Pricing copy + hard-stop UX to `/pricing`

Status: resolved

## Parent

`.scratch/credits-welcome-grant/PRD.md`

## What to build

Align user-facing Free messaging with the welcome pack: one-time **12 credits**, soft promise of about one generate and a few edits (actual usage may vary)—remove daily 5 / monthly 30 / daily-expiry FAQ claims. When Generate or Modify cannot start for insufficient credits, hard-stop with a clear path to `/pricing`. Preview, project history, and Design Mode local writeback remain usable. Confirm Remix copy and Publish still spend 0 credits. Sidebar balance badge continues to show real balance and link to pricing. Optionally note the change in changelog. Update `CONTEXT.md` Credits glossary bullet to match.

## Acceptance criteria

- [x] `/pricing` (zh + en) Free tier and FAQs describe welcome 12 / soft promise; no daily-5 / monthly-30 / daily-expiry Free narrative
- [x] Cancel-subscription FAQ no longer says users return to Free daily grants
- [x] Insufficient balance on Generate/Modify shows hard stop CTA to `/pricing`
- [x] While hard-stopped on LLM actions, preview / history / Design Mode local writeback still work
- [x] Remix copy and Publish remain zero-credit
- [x] Credit badge still reflects balance and links to `/pricing`
- [x] `CONTEXT.md` Credits line updated for welcome-only Free

## Blocked by

- `.scratch/credits-welcome-grant/issues/02-welcome-grant-kill-daily.md`

## Answer

i18n + 402 → `/pricing` in generate/modify clients; `docs/product/credits-v0.3-welcome.md` + changelog v1.14.
