# 04 — Feishu text Modify loop (continuation, credits, deep link)

Status: resolved

## Parent

`.scratch/feishu-modify-mvp/PRD.md`

## What to build

Wire plain-text Feishu DMs (non-commands) to the headless Modify runner for the user’s Feishu active project.

Flow: if no active project → tell user to set it in Studio; if in-flight → reject; if insufficient credits → short message + `/pricing` deep link; else send **ack** (“收到，正在改《项目》…”), run Modify, then send **completion** with assistant summary + Studio deep link (no screenshot yet). Persist history so refresh/re-open Studio shows the same turns.

Continuation: when the last turn is `awaitingReply`, the next plain DM within **30 minutes** continues that exchange; after timeout, treat as a new instruction. `/clear` abandons awaiting state. Commands from issue 03 keep taking precedence over Modify.

## Acceptance criteria

- [x] Plain-text DM on active project runs headless Modify with Studio-equivalent Credits behavior
- [x] User receives an ack before the long run finishes, then a completion message with Studio deep link
- [x] In-flight projects get a reject message (no overlapping run)
- [x] Insufficient balance gets Feishu copy + `/pricing` deep link without starting a billed run
- [x] `awaitingReply` + next message within 30 minutes continues; after 30 minutes starts a new instruction
- [x] `/clear` clears awaiting continuation
- [x] After Feishu Modify, reloading Studio shows the new Modify History turns from DB
- [x] Images still refused; Generate / Design Mode not exposed

## Blocked by

- `.scratch/feishu-modify-mvp/issues/01-prefactor-headless-modify-inflight.md`
- `.scratch/feishu-modify-mvp/issues/03-feishu-bot-identity-commands.md`

## Answer

- `lib/feishu/runFeishuModify.ts` — ack → `runHeadlessModifyTurn` → completion + Studio deep link.
- Events route enables `modifyEnabled: true` and delegates plain text here.
- `forceFreshInstruction` on Modify for `/clear` + 30min idle.
- Screenshot left to issue 05.
