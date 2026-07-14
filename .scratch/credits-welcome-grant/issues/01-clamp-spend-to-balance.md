# 01 — Prefactor: clamp post-run spend to balance

Status: resolved

## Parent

`.scratch/credits-welcome-grant/PRD.md`

## What to build

Post-run credit charges must never fail the user after a gate already passed. When accumulated usage exceeds remaining balance, debit only what remains (balance → 0), record that charged amount, and do not create debt. Runs complete normally. Pre-start gates (`canAfford`) stay unchanged in this slice.

## Acceptance criteria

- [x] When usage credits > balance, spend charges `min(usage, balance)` and leaves balance at 0
- [x] No negative balance and no debt / unpaid-delta ledger rows
- [x] When usage ≤ balance, behavior matches today’s full debit
- [x] Zero / disabled-credits paths remain no-ops
- [x] Unit tests cover clamp, exact-balance, and under-balance cases (billing seam)

## Blocked by

None - can start immediately

## Answer

`clampSpendAmount` in credits + `spendCredits` uses it so overage debits only remaining balance (charged amount recorded, no debt).
