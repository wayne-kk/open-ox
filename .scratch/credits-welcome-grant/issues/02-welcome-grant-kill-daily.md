# 02 — Welcome 12 credits + kill Free daily grant + Generate gate ≥ 8

Status: resolved

## Parent

`.scratch/credits-welcome-grant/PRD.md`

## What to build

Replace Free daily grants with a one-time welcome pack: on first credit-account ensure, grant **12 credits** idempotently per `user_id` (ledger key such as `welcome:{userId}`). Welcome credits do not expire. Stop applying daily Free grants entirely (including after Pro cancel → free). Raise Generate start gate to **8** credits; Modify gate stays **0.5**. Pro subscription and top-up flows must keep working. `CREDITS_ENABLED=0` stays no-op.

## Acceptance criteria

- [x] First ensure for a new Free user yields balance 12 with a single welcome ledger entry
- [x] Second ensure / login does not grant another 12
- [x] Free daily grant no longer changes balances on new UTC days
- [x] `canAfford` for Generate requires ≥ 8; Modify still ≥ 0.5
- [x] Balance in [0.5, 8) can start Modify but not Generate
- [x] Pro / top-up grant paths still credit correctly; cancel keeps remaining balance and does not resume daily grants
- [x] With credits disabled, gates/charges/grants remain no-ops
- [x] Unit tests for welcome idempotency, no daily grant, and new minimums

## Blocked by

- `.scratch/credits-welcome-grant/issues/01-clamp-spend-to-balance.md`

## Answer

`ensureCreditAccount` + `WELCOME_CREDITS=12` + `MIN_GENERATE=8`; daily grant path is a no-op.
