# 04 — Queue pause + fail-stop + retry / skip / cancel remaining

Status: resolved

## Parent

`.scratch/modify-board-run-v0.1/PRD.md`

## What to build

Complete the control plane on a live BoardRun: user can pause subsequent tasks (current in-flight Modify is allowed to finish; no hard-abort requirement). On card failure, stop the queue and present retry / skip-and-continue / cancel-remaining in the chat board UI. Retry schedules another Modify for that task (new turn, billable as another card). Skip marks the card skipped and continues. Cancel remaining terminates pending work; already written cards stay. Copy must describe queue pause accurately.

## Acceptance criteria

- [x] Pause prevents starting the next card after the current one finishes (documented: does not hard-kill in-flight Modify)
- [x] Card failure leaves the BoardRun in a failed/stopped state with no auto-advance
- [x] Retry re-dispatches Modify for the failed card, appends a new Modify History Turn, and charges like a normal card
- [x] Skip-and-continue advances past a failed/unwanted card
- [x] Cancel remaining marks pending tasks cancelled and stops scheduling
- [x] Studio UI exposes these actions on the active board with clear outcomes in the progress pin/chat card
- [x] Orchestrator/API tests cover pause, fail-stop, retry, skip, and cancel-remaining

## Blocked by

- `.scratch/modify-board-run-v0.1/issues/03-serial-execute-progress-pin-online-resume.md`

## Answer

- API actions: `pause`, `cancel_remaining`, `retry`, `skip`, `run_next`/`continue`
- Pin copy:「暂停后续」= queue only
- Orchestrator tests (issue 01) + `runBoardCardTurn` integration test
