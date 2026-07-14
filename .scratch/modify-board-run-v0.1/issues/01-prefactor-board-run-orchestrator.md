# 01 — Prefactor: BoardRun orchestrator + persistence contract

Status: resolved

## Parent

`.scratch/modify-board-run-v0.1/PRD.md`

## What to build

Introduce the BoardRun domain model and a pure (or near-pure) orchestrator that is the primary test seam for this feature. It must accept a current BoardRun snapshot plus a command (propose tasks, confirm edited list, pause queue, continue, mark card modify succeeded/failed, retry, skip, cancel remaining) and return the next snapshot plus a dispatch decision (whether to start a Modify for a given card instruction).

Persist BoardRun records per project with enough fields to hydrate an incomplete board after refresh. Encode the v0.1 invariant that **advancing to the next card requires an online/continue signal** — closing the client must not imply unattended drain. Do not wire real Modify execution or Studio UI in this slice; fake or inject the “modify finished” signal in tests.

## Acceptance criteria

- [x] BoardRun + task statuses cover proposed / running / paused / failed / completed / cancelled (or equivalent clear enum set documented in code)
- [x] Orchestrator enforces max 6 tasks, serial dispatch (at most one in-flight card), fail-stop (no auto-advance after failure), and queue-only pause (pause does not claim hard-abort of current card)
- [x] Persistence round-trip can reload an incomplete BoardRun for a project
- [x] Tests prove: happy-path advance on success, fail-stop, pause blocks next dispatch, cancel-remaining, retry creates a new dispatch for the same task slot, and no background auto-drain without continue/online
- [x] No Studio UI and no production calls into the Modify runner required to merge this slice

## Blocked by

None - can start immediately

## Answer

Shipped `lib/modify/boardRun/`:

- `advanceBoardRun` pure orchestrator + `AdvanceBoardRunError`
- `MemoryBoardRunStore` persistence contract (save / loadActive / clear)
- Vitest coverage in `advanceBoardRun.test.ts` (15 cases)
- Domain term recorded in `CONTEXT.md` → **BoardRun**

DB/Supabase wiring deferred to later slices that hydrate Studio; memory store is the v0.1 contract + test seam.
