# 05 — Active-board mutual exclusion + force “split into tasks”

Status: resolved

## Parent

`.scratch/modify-board-run-v0.1/PRD.md`

## What to build

When a BoardRun is active in a blocking state (running, or paused/failed with remaining work that still owns the session), block ordinary Studio Modify sends and Design Mode Direct Apply with a clear message and a path to finish, pause/cancel, or otherwise resolve the board. Also ship the explicit **split into tasks** entry point so users can force the planner/proposal flow even when the router kept them on a single Modify.

Prefer sharing any existing project in-flight / busy vocabulary (e.g. from headless Modify / Feishu work) rather than inventing a second lock language.

## Acceptance criteria

- [x] With an active blocking BoardRun, plain Modify submission is rejected or disabled with clear UI copy
- [x] Design Mode Direct Apply is similarly blocked while that BoardRun is active
- [x] User can resolve the busy state via board actions (continue / cancel remaining / complete) and then use Modify / Direct Apply again
- [x] An explicit “split into tasks” control can open the propose/edit flow from a normal chat context
- [x] Force-split respects max-6 planner rules and the same confirm / decline-to-single exits as the automatic suggestion path
- [x] Tests or a focused integration check cover the busy gate for Modify (and Direct Apply if testable at the same seam)

## Blocked by

- `.scratch/modify-board-run-v0.1/issues/02-board-propose-edit-confirm.md`
- `.scratch/modify-board-run-v0.1/issues/03-serial-execute-progress-pin-online-resume.md`

## Answer

- `isBoardRunBlocking` + Modify route `BOARD_RUN_ACTIVE` + Design Mode patch 409
- Studio Apply disabled + Design Mode hint when blocking
-「拆成任务」(`forceBoard`) from issue 02; unit tests for `isBoardRunBlocking`
