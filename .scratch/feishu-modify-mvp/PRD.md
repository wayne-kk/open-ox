# Feishu Modify MVP — 私聊改站闭环

Status: ready-for-agent

**日期**：2026-07-14  
**来源**：grilling 共识（个人效率验证；非群协作 / 非第二 Studio）  
**术语**：[`CONTEXT.md`](../../CONTEXT.md)（Modify Agent、Modify History Turn、Credits、Studio、Workspace）  
**相关想法**：[`docs/product/hermes-agent-ux-scenarios-20260714.md`](../../docs/product/hermes-agent-ux-scenarios-20260714.md) §3.3（本文为收窄后的 MVP，不含中断重定向 / 热同步）

---

## Problem Statement

改站反馈与零碎指令常发生在飞书，但执行仍要求打开 Studio。已有飞书 OAuth 登录，没有 Bot 入口。需要一条**可验证的个人效率闭环**：私聊发文本 → Modify → 预览截图 + Studio 深链，且与 Studio **共用 Modify History**，再决定是否加大投入。

## Solution

飞书**私聊 Bot**（仅飞书登录用户）：在 Studio 设「飞书当前项目」后，纯文本走与 Studio 同一套 Credits / Modify / DB `modification_history`。先发受理回执，完成后再发结果（首页视口截图优先；失败则文案 + 深链）。命令面极简；同项目 in-flight 互斥拒绝；澄清轮下一条默认续写（30 分钟超时）。不做热同步——刷新/重进 Studio 可见 History。

## User Stories

1. As a Feishu-OAuth Open-OX user, I want to set my Feishu active project in Studio, so that private-chat modifies target the site I am working on.
2. As that user, I want `/help`, `/status`, `/use`, and `/clear` in Feishu DM, so that I can discover commands, see/switch the active project, and abandon an awaiting continuation without spending a Modify.
3. As that user, I want a plain-text DM to run Modify on my active project (same credits gates and charges as Studio), so that I can edit without opening the website.
4. As that user, I want an immediate “received / working” reply and a later completion reply, so that long Modify runs do not feel like a black hole.
5. As that user, I want the completion reply to include a homepage preview screenshot when possible, plus a Studio deep link, so that I can glance at the result on my phone and continue in Studio if needed.
6. As that user, when Modify is awaiting a follow-up, I want my next DM within 30 minutes to continue that turn, so that clarifications work on mobile.
7. As that user, when a Modify is already in flight for that project (Studio or Feishu), I want a clear reject message, so that I do not double-spend or corrupt history.
8. As that user with insufficient credits, I want a short Feishu message and a `/pricing` deep link, so that billing matches Studio hard-stop behavior.
9. As that user who opens Studio after a Feishu Modify (refresh or re-enter), I want to see the same Modify History turns, so that Feishu and Studio are one conversation log.
10. As a Google-only (or non-Feishu-login) user messaging the Bot, I want to be told to sign in with Feishu on the website, so that identity stays `open_id` → existing account with no new link flow in MVP.

## Implementation Decisions

### Product rules (locked)

| Rule | Value |
|------|--------|
| Success goal | Personal efficiency (dogfood first; optional weak signal: bind then ≥2 successful Modifies in 7 days) |
| Surface | Feishu **DM only** |
| Identity | Feishu OAuth users only (`feishu_open_id` / `open_id` lookup); no Google↔Feishu link |
| Active project | Set in **Studio**; Feishu `/use` for light switch |
| Concurrency | Reject if project already has in-flight Modify |
| Continuation | Next plain text continues when `awaitingReply`; **30 min** idle → new instruction; `/clear` aborts await |
| Progress UX | Ack message + completion message (no step heartbeat) |
| Screenshot | Homepage viewport one shot; on failure degrade to text + Studio deep link |
| Credits | Identical to Studio (Modify gate ≥ 0.5, same charge/clamp) |
| Attachments | Text only; images → “use Studio” + deep link |
| Commands | `/help` `/status` `/use` `/clear`; all other text → Modify or continuation |
| Model | Product default (same as Studio default); no `/model` |
| Studio sync | No live sync; refresh / re-open loads DB history |
| Generate / Design Mode / groups / interrupt-redirect / cron / doc→site | Out of scope |

### Seams (conceptual)

1. **Headless Modify** — server-side one turn: DB history + default model + credits + persist `modification_history` / Modify History Turn; no Studio client `conversationHistory` required.
2. **Project in-flight lock** — shared by Studio modify route and Feishu runner.
3. **Feishu active project** — per-user pointer to a project the user owns; Studio UI write; Bot read/`/use`.
4. **Feishu gateway** — event verify → identity → command router vs Modify → reply (ack / result / errors).
5. **Preview screenshot for Bot** — reuse homepage capture approach; attach to Feishu message or degrade.

### Testing Decisions

- Prefer unit/integration on: identity resolve, command parse, active-project get/set, in-flight reject, continuation timeout, headless modify persistence, screenshot degrade path.
- Full Feishu webhook E2E may be manual / dogfood; do not require live Feishu in CI unless a recorded fixture harness already exists.

## Out of Scope

1. Group chat / @Bot collaboration  
2. Generate from Feishu  
3. Design Mode / Direct Apply from Feishu  
4. Image/attachment Modify  
5. Interrupt-and-redirect in-flight runs  
6. Multi-client History hot sync / push  
7. Linking Google accounts to Feishu Bot  
8. Model picker, pricing UI, or full Studio in Feishu  
9. Cron / health-check delivery to Feishu  
10. Feishu doc → one-click site  

## Grilling lock table

| # | Decision |
|---|----------|
| 1 | Validate personal efficiency (A) |
| 2 | Identity: Feishu login only (A) |
| 3 | Active project: Studio primary + light `/use` (A) |
| 4 | Concurrent: reject (A) |
| 5 | Awaiting: next message continues; 30 min timeout (A) |
| 6 | Screenshot: homepage viewport; degrade to deep link (A) |
| 7 | Progress: ack + completion (A) |
| 8 | Credits: same as Studio (A) |
| 9 | Images: not in MVP (A) |
| 10 | Commands: slash set; else Modify (A) |
| 11 | Model: product default (A) |
| 12 | Active project UI: Studio (B) |
| 13 | Studio sync: no hot sync (A) |
| 14 | Non-goals 1–10 accepted |
| 15 | Success: dogfood + weak bind→2 Modifies/7d signal (D) |

## Issue map

| # | Slice | Blocked by |
|---|--------|------------|
| 01 | Prefactor: headless Modify + in-flight lock + DB history | — |
| 02 | Studio: set Feishu active project | — |
| 03 | Feishu Bot: identity + commands (no Modify) | 02 |
| 04 | Feishu text Modify loop (continuation, credits, deep link) | 01, 03 |
| 05 | Completion homepage screenshot (degrade on failure) | 04 |

## Comments

- 2026-07-14: grilling confirmed; slices approved for publish.
