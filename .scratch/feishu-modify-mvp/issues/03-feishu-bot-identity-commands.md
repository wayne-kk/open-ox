# 03 — Feishu Bot: identity gate + command surface (no Modify)

Status: resolved

## Parent

`.scratch/feishu-modify-mvp/PRD.md`

## What to build

Stand up Feishu **DM** event handling end-to-end: verify events, resolve `open_id` to an Open-OX user who signed in with Feishu, and handle only the command surface—**no** Modify / LLM spend yet.

Commands: `/help`, `/status` (active project name/id or “unset—set in Studio”), `/use <name-or-id>` (switch among owned projects), `/clear` (clear awaiting-continuation state if any stub exists; otherwise no-op with a short reply). Unknown slash commands get a short help hint. Plain non-command text in this slice replies that Modify is not wired yet **or** is ignored with a pointer to wait for the next slice—prefer an explicit “coming soon / not enabled” message so dogfooders are not confused.

Unresolvable identity (no Feishu login user): reply to sign in with Feishu on the website. Images: reply that images are unsupported; use Studio + deep link if easy.

## Acceptance criteria

- [x] Feishu DM events are accepted and answered in private chat
- [x] Known Feishu-login user is resolved via `open_id` / `feishu_open_id`
- [x] Unknown / non-Feishu-login sender gets a sign-in-with-Feishu message
- [x] `/help`, `/status`, `/use`, `/clear` behave as specified; `/status` reflects issue 02’s active project
- [x] `/use` only switches to projects owned by that user; failures get a clear reply
- [x] No Modify run and no Credits charge occur in this slice *(command path still skipModify; Modify wired in 04)*
- [x] Group chat can be ignored or politely declined (DM-only product rule)

## Blocked by

- `.scratch/feishu-modify-mvp/issues/02-studio-feishu-active-project.md`

## Answer

- `POST /api/feishu/events` — URL challenge + `im.message.receive_v1`; needs `FEISHU_VERIFICATION_TOKEN`.
- `lib/feishu/botCommands.ts`, `handleBotCommand.ts`, `openApi.ts`, `continuationSuppress.ts`.
- Identity: `resolveUserIdByFeishuOpenId` after OAuth `linkFeishuOpenId`.
