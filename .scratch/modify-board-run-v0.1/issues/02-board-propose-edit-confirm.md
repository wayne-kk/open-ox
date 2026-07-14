# 02 — Propose editable board + decline to single Modify

Status: resolved

## Parent

`.scratch/modify-board-run-v0.1/PRD.md`

## What to build

End-to-end path for **suggesting** a board without writing site files yet: when Modify intent looks wide/multi-goal (e.g. `code_change` + `broad`), run the dedicated board planner, show a chat-embedded editable task list (rename / reorder / delete / merge / add simple cards, max 6), persist a `proposed` BoardRun, and let the user either confirm the list or decline to a normal single Modify.

Planner output must be user-language cards (title + Modify instruction). The propose/plan step must not charge a full Modify credit. Also expose enough UI/API surface that a later slice can call “split into tasks” explicitly; the decline CTA “run as one Modify” must work in this slice.

## Acceptance criteria

- [x] Wide/multi-goal Studio Modify can surface a proposed board instead of immediately starting one Modify
- [x] User can edit the proposal within the max-6 rules and persist those edits on the BoardRun
- [x] Confirming materializes the final ordered task list without having executed card Modifies yet
- [x] Declining starts (or returns the user to) a single Modify with the original instruction and cancels/abandons the proposal cleanly
- [x] Propose/plan path does not bill a full Modify; behavior is covered by test or an explicit credits gate assertion
- [x] Narrow edits still default to single Modify (no forced board)

## Blocked by

- `.scratch/modify-board-run-v0.1/issues/01-prefactor-board-run-orchestrator.md`

## Answer

- Planner: `planModifyBoard` + `modifyBoardPlanner.md`; `shouldSuggestModifyBoard` (Studio `preferBoardSuggest`; headless-safe)
- Persist: `FileBoardRunStore` under site `.ox/board-run.json`
- Modify early-exit emits `board_proposed` (no agent loop); charge reason `modify board propose`
- API: `GET/POST /api/projects/[id]/board-run` (`revise` / `confirm` / `decline`)
- Studio: `BoardProposeCard`,「拆成任务」, decline → `forceSingleModify`
- Confirm stops at `running` + pending tasks (serial execute = issue 03)
