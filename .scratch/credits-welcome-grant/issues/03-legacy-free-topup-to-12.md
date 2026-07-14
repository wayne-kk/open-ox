# 03 — Legacy Free users: one-time top-up to 12

Status: resolved

## Parent

`.scratch/credits-welcome-grant/PRD.md`

## What to build

On ensure, migrate eligible legacy Free accounts once: `plan=free`, never successfully paid (no Pro / no successful Stripe credit grants), and `balance < 12` → raise balance **to** 12 (not +12 on top). Idempotent (e.g. `welcome_migrate_v3:{userId}`). Paid users and balances already ≥ 12 are untouched. New users who already received the welcome 12 must not be double-migrated.

## Acceptance criteria

- [x] Unpaid Free with balance &lt; 12 becomes exactly 12 once, with a ledger adjust/migrate entry
- [x] Same user on later ensure is not topped up again
- [x] Unpaid Free with balance ≥ 12 is left unchanged
- [x] Pro or users with successful paid grants are not migrated by this path
- [x] Unit tests cover &lt;12, ≥12, already-migrated, and paid-exclusion cases

## Blocked by

- `.scratch/credits-welcome-grant/issues/02-welcome-grant-kill-daily.md`

## Answer

`welcomeTopUpAmount` + migrate idempotency in `ensureCreditAccount`.
