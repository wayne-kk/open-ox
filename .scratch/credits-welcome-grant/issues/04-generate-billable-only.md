# 04 — Generate charges only when a previewable deliverable exists

Status: resolved

## Parent

`.scratch/credits-welcome-grant/PRD.md`

## What to build

End-of-Generate billing must follow deliverable value: debit accumulated usage (clamped to balance) only when the run left an openable preview / Studio-usable project artifact. Non-deliverable failures charge **0** (full refund equivalent = do not settle). If the user cancels after a usable preview already exists, still charge. Modify turns keep metering actual usage (clamped). Expose billability via the billing seam so the generate adapter stays thin.

## Acceptance criteria

- [x] Generate with no previewable deliverable → charged 0 despite positive usage accumulator
- [x] Generate with previewable deliverable → charged `min(usage, balance)`
- [x] Cancel after usable preview still bills; cancel/fail with no artifact does not
- [x] Modify still charges actual usage with balance clamp from issue 01
- [x] Tests cover billable vs non-billable generate decisions and adapter charge skip

## Blocked by

- `.scratch/credits-welcome-grant/issues/01-clamp-spend-to-balance.md`
- `.scratch/credits-welcome-grant/issues/02-welcome-grant-kill-daily.md`

## Answer

`isGenerateRunBillable` (`success === true`); `executeGenerationRun` only charges when billable.
