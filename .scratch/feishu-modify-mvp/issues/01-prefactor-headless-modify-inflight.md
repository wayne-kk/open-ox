# 01 — Prefactor: headless Modify + in-flight lock + DB history

Status: resolved

## Parent

`.scratch/feishu-modify-mvp/PRD.md`

## What to build

Provide a server-side way to run one Modify turn for an owned project without requiring Studio’s client `conversationHistory` payload: load/merge history from the project’s persisted modification history, use the product default model, apply the same Credits gate and charge rules as today’s Modify path, persist the resulting Modify History Turn back to that project, and expose a **project-scoped in-flight lock** so a second Modify (any caller) is rejected while one is running.

Studio’s existing HTTP Modify route may keep working as today, but should share the in-flight lock (and ideally the same runner) so Feishu and Studio cannot overlap on one project.

## Acceptance criteria

- [x] A headless/server entry can complete one Modify turn using only project id + user id + instruction (optional: explicit continuation flag), reading history from DB
- [x] Successful turns append to the same persisted modification history Studio already loads on project open
- [x] Credits gate and post-run charge/clamp match Studio Modify behavior
- [x] Default model is the product default (no Studio UI selection required)
- [x] While a Modify is in flight for a project, a second start attempt fails with a clear “busy” outcome (no second charge started)
- [x] Automated tests cover: happy-path persistence shape, in-flight reject, and credits disabled / insufficient gate behavior at the seam

## Blocked by

None - can start immediately

## Answer

- `lib/modify/modifyInFlight.ts` — project-scoped process-local lock; Studio `POST /api/projects/[id]/modify` acquires/releases (409 `MODIFY_IN_FLIGHT`).
- `lib/modify/runHeadlessModifyTurn.ts` — DB-history-only Modify + credits gate/charge + default model; returns structured ok/err for Feishu.
- Tests: `lib/modify/*.test.ts`.
