# Modify Board Run v0.1 — 看板式任务切片改站

Status: ready-for-agent

**日期**：2026-07-14  
**来源**：grilling 共识（Hermes §3.2 → Open-OX 任务切片壳）  
**术语**：[`CONTEXT.md`](../../CONTEXT.md)（Modify Agent、Modify History Turn、Credits、Design Mode、Studio）  
**相关想法**：[`docs/product/hermes-agent-ux-scenarios-20260714.md`](../../docs/product/hermes-agent-ux-scenarios-20260714.md) §3.2；Working Memory：[`docs/product/modify-working-memory-v0.1.md`](../../docs/product/modify-working-memory-v0.1.md)

---

## Problem Statement

When a Studio user asks for a multi-part site cleanup (pricing copy, mobile hero, SEO, a11y, etc.), today’s Modify path treats it as **one long black-box run**. They cannot see per-goal progress, reorder work, pause later tasks, or retry a single failed goal without feeling like the whole round was wasted. Credits feel like one opaque spend. Trust drops exactly when the change set is largest.

## Solution

For wide / multi-goal Modify requests, Studio **suggests a short editable task board** (2–6 cards). The user confirms (or edits, or declines back to a single Modify). The product then runs **one existing Modify per card, serially**, with a visible queue, a light progress pin, durable BoardRun state, queue-level pause/cancel, and fail-stop with retry / skip / cancel-remaining. Each card lands as a normal Modify History Turn. No true parallel workers, no background unattended runs, no patch staging.

## User Stories

1. As a Studio user with a broad multi-goal instruction, I want the product to suggest splitting it into a short task list, so that I am not forced into one opaque Modify.
2. As that user, I want to edit task titles, reorder, delete, merge, and add simple cards (up to 6) before anything writes, so that the plan matches what I actually want.
3. As that user, I want to decline the board and run a single Modify instead, so that a bad split does not trap me.
4. As that user on a narrow edit, I want the default path to stay a single Modify, so that small changes stay fast.
5. As that user, I want an explicit “split into tasks” action anytime, so that I can force a board when the router under-splits.
6. As that user, I want confirming the board to start serial execution of real Modifies, so that each card actually changes the site.
7. As that user, I want each finished card to write immediately to the project (preview/HMR), so that I am always looking at real source, not a staging area.
8. As that user, I want a light progress summary pinned near the composer, so that I can see which card is running without opening a project-management UI.
9. As that user, I want board progress and actions embedded in the chat thread, so that the flow still feels like one Modify conversation.
10. As that user, I want the board to auto-continue to the next card after success by default, so that large cleanups do not require a click per card.
11. As that user, I want “pause subsequent tasks” to stop scheduling the next card after the current one finishes, so that I can say “don’t touch Pricing yet” without claiming hard abort of the in-flight Modify.
12. As that user, I want clear copy that pause means “pause the queue,” not “stop the model mid-stroke,” so that expectations match v0.1 technical limits.
13. As that user, when a card fails, I want the queue to stop, so that later cards do not pile onto a broken base.
14. As that user after a failure, I want retry / skip-and-continue / cancel-remaining, so that I can recover without restarting the whole board from scratch.
15. As that user, I want retry to count as another billable Modify card, so that Credits stay honest.
16. As that user, I want each card to appear as its own Modify History Turn, grouped under one BoardRun, so that history, continuation, and debugging stay aligned with today’s domain model.
17. As that user, I want later cards to receive Working Memory plus a short board summary (goal + completed card one-liners + current instruction), so that serial cards stay coherent without dumping full prior transcripts.
18. As that user who refreshes Studio mid-board, I want the BoardRun to reload from the server, so that the board does not vanish.
19. As that user who closes Studio, I want remaining cards **not** to run in the background, so that the site is never modified unattended.
20. As that user who returns to an incomplete board, I want to continue the remaining queue while online, so that durable state is useful without unattended workers.
21. As that user with an active BoardRun (running or paused-with-remaining), I want ordinary Modify send and Design Mode Direct Apply blocked, so that I do not create conflicting writes.
22. As that user, I want a clear message explaining the mutual exclusion and how to finish or cancel the board, so that I am not stuck without a path forward.
23. As that user, I want Credits to accrue per executed card, so that spend matches visible work units.
24. As that user, I want the plan/preview step before confirm to avoid charging a full Modify, so that “confirm before burn” matches the blueprint philosophy.
25. As that user, I want board completion to feel finished in chat (summary + progress pin cleared/completed), so that “merge into preview” is a wrap-up, not a second git merge.
26. As that user, I want failed or cancelled cards to remain visible on the board record, so that I can see what did not land.
27. As a power user, I understand step-by-step confirm-after-each-card is deferred, so that v0.1 stays focused on auto-run plus fail-stop.
28. As a product/engineering agent, I want BoardRun orchestration testable without re-testing Modify internals, so that the feature can ship against a stable seam.

## Implementation Decisions

### Product rules (locked in grilling)

| Rule | Value |
|------|--------|
| Shape | Task-slice shell over existing Modify; serial only |
| Trigger | Hybrid: suggest board on wide/multi-goal (e.g. intent `scope: broad`); narrow stays single; user can force board or force single |
| Writes | Each card writes immediately via normal Modify; no staging/worktree merge |
| Pacing | Default auto-run next card on success; no step-by-step confirm mode in v0.1 |
| History | One Modify History Turn per card + lightweight BoardRun grouping metadata |
| Pause/cancel | Queue control only; do not hard-abort in-flight Modify in v0.1 |
| Pre-run edit | Editable list: rename, delete, reorder, merge, add simple cards; max 6 |
| Persistence | BoardRun durable on server |
| Scheduling | Online-only: schedule next card only with an active Studio session or explicit continue; no unattended background drain |
| Credits | Per executed card (same metering as Modify); plan/preview should not charge a full Modify |
| Failure | Fail-stop; retry / skip-and-continue / cancel-remaining |
| Concurrency | Active board mutually excludes plain Modify send and Design Mode Direct Apply |
| UI | Chat-embedded cards + light progress pin above composer; not a full Kanban side panel |
| Planner | Dedicated board planner producing user-language cards (title + Modify instruction) |
| Card context | Existing Working Memory + short Board summary block |
| Diff | Not required for v0.1 board acceptance |

### Domain / architecture

- Introduce a **BoardRun** entity (project-scoped) that stores: original user goal, ordered tasks, per-task status, links to resulting Modify History Turns (or turn ids), run status (`proposed` / `running` / `paused` / `failed` / `completed` / `cancelled`), and timestamps.
- Primary test/implementation seam: a **BoardRun orchestrator** that, given commands and the current run, returns the next snapshot and whether/with-what-instruction to invoke the existing Modify runner. Modify internals stay unchanged.
- Secondary seam: **board planner** that returns 2–6 validated cards (or a structured validation error).
- Reuse intent routing signals already available for Modify (`code_change` + `scope`) to decide when to *suggest* a board; keep an explicit force-split entry and a force-single decline on the suggestion card.
- Studio client: render proposal/progress/failure actions in the conversation; pin compact progress above the composer; on load, hydrate any incomplete BoardRun and offer continue when online.
- While BoardRun is active in a blocking state, gate Studio Modify submission and Design Mode Direct Apply with the same product busy semantics used elsewhere for in-flight work.
- Credits: each scheduled card execution goes through the normal Modify credits gate/charge path; planner/proposal path must be explicitly non-Modify or cheap and documented.

### API / interaction sketch (behavioral)

- Propose board → persist `proposed` → client edits → confirm (materialize final task list) **or** decline-to-single-Modify.
- Confirm → `running` → orchestrator selects next pending task → call Modify → on success mark task done and auto-advance if online and not paused → on failure mark task failed and stop.
- Pause → do not start further tasks after current in-flight card completes.
- Continue → resume scheduling while online.
- Retry failed task → new Modify execution / new turn linked as retry for that task slot → resume policy same as success path.
- Skip → mark skipped, advance.
- Cancel remaining → terminal cancel for pending tasks; completed writes stay.

## Testing Decisions

- Prefer **external behavior** tests at the BoardRun orchestrator: inputs are commands + prior snapshot (+ “modify finished/failed” signals); outputs are next snapshot + dispatch decision. Do not assert Modify loop internals.
- Planner tests: schema/validation (cardinality 2–6, non-empty instructions), with LLM mocked like existing Modify intent-router tests.
- Persistence/hydration tests: reload incomplete run; assert no auto-dispatch without an online/continue signal.
- Prior art: Modify Working Memory / intent router / history turn unit tests under the Modify flow; Studio busy/in-flight patterns from recent headless Modify / Feishu work if present.
- UI may be thin manual/demo verification for chat card + pin; automated coverage concentrates on orchestrator + planner + API busy gates.

## Out of Scope

- True parallel workers / multi-process Kanban
- Hard-abort of in-flight Modify
- Unattended background execution after Studio closes
- Step-by-step confirm-after-each-card mode
- Staged patches / worktree / “merge into main project” second write
- Full Kanban side panel or preview-area board mode
- Requiring Before/After Diff for board v0.1
- Feishu delivery of board events (separate from Feishu Modify MVP)
- Skill extraction / taste cards (Hermes 3.1 / 3.6)
- Per-card model routing (cheap vs strong models)

## Further Notes

- Document copy must say **pause subsequent tasks**, never “instant stop writing.”
- “One-click merge into preview” in the idea doc maps to **board wrap-up + preview refresh**, not a VCS merge.
- If Feishu Modify MVP lands an in-flight lock, BoardRun mutual exclusion should share that project busy concept rather than inventing a second lock vocabulary.
- Suggested issue breakdown lives under `.scratch/modify-board-run-v0.1/issues/`.

## Comments

- Seams presented in chat (orchestrator primary, planner secondary); user proceeded to approve issue breakdown and publish (“写吧”).
