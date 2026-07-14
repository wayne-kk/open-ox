# 03 — Serial card execution + progress pin + online resume

Status: resolved

## Parent

`.scratch/modify-board-run-v0.1/PRD.md`

## What to build

After confirm, execute BoardRun cards **serially** through the existing Modify runner. Each card becomes one Modify History Turn, linked on the BoardRun. While a card runs, inject existing Working Memory plus a short board summary (original goal, completed card one-liners, current card instruction). Auto-advance to the next pending card on success when the user is online.

Show chat-embedded progress and a light progress pin above the composer. On Studio reload, hydrate the incomplete BoardRun; remaining cards must **not** run while the client is gone; when the user is back, continue scheduling online. Board completion wraps up in chat (summary / pin completed) — preview refresh only, no second merge pipeline. Credits accrue per executed card via the normal Modify path.

## Acceptance criteria

- [x] Confirming a multi-card board runs cards one-by-one via existing Modify, writing files as each card finishes
- [x] Each card persists a Modify History Turn and is grouped under the BoardRun
- [x] Card prompts include Working Memory + short board summary (not full prior card transcripts)
- [x] Progress is visible in chat and via a compact pin near the composer
- [x] Refresh restores board state; closed Studio does not drain the queue; returning online can continue remaining cards
- [x] Successful full run reaches a completed BoardRun with a clear wrap-up in the UI
- [x] Each executed card goes through normal Modify credits gating/charging

## Blocked by

- `.scratch/modify-board-run-v0.1/issues/01-prefactor-board-run-orchestrator.md`
- `.scratch/modify-board-run-v0.1/issues/02-board-propose-edit-confirm.md`

## Answer

- `runBoardCardTurn`: one card per request; success/fail with `online:false` (no server drain)
- Studio `drainBoardQueue` after confirm; abort on unmount
- `formatBoardSummaryBlock` injected into Modify agent prompt
- `BoardProgressPin` + chat task list; headless Modify per card (Credits)
