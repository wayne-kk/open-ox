# New User Onboarding v0.1 — 新人引导

Status: ready-for-agent

**日期**：2026-07-15  
**来源**：grilling 共识（本会话定稿）  
**术语**：[`CONTEXT.md`](../../CONTEXT.md)（Workspace、Studio、Design Mode、Direct Apply、Modify、Credits）  
**对照**：[`docs/product/credits-v0.3-welcome.md`](../../docs/product/credits-v0.3-welcome.md)、现有 Intent / 气质选择器、`lib/analytics/client.ts`

---

## Problem Statement

新用户注册后面对空白 Workspace / 裸 prompt，不清楚如何用 welcome 12 credits 换到一次成功体验；容易空耗首次 Generate，或出站后不知道 Design Mode 可免费点选改站，导致会话短、不敢改、难形成「我做出并改过一个站」的记忆。现有产品已有 Intent 澄清、气质三选一、Design Mode Direct Apply 与 analytics，但缺少**用户级、可完成的引导闭环**把这些能力串成第一次成功。

## Solution

做一层叠在现有能力上的新人引导（不新造校准栈、不提 Remix、不推销 Modify）：

1. **营销首页 + Workspace 空态**：大 prompt 旁 4–5 条写死示例 brief 芯片（一点写入输入框）+ Credits 软承诺文案。  
2. **生成前**：软门复用现有 Intent / 气质选择器（推气质 + 最多三问，可跳过直接生成）。  
3. **生成中**：轻量人话章节标题（不做中间预览闪现）。  
4. **Studio**：常驻 2 步进度（① 生成成功可预览 ② Design Mode 改一处）；预览就绪后非打断提示条，**自动开启 Design Mode**，任意一次成功 Direct Apply 即完成引导。  
5. **状态**：服务端用户偏好；完成 2 步或「不再显示」后用户级永久关闭。  
6. **指标**：引导完成 = Design Mode 成功写回；Modify 仅旁路打点，v0.1 不做引导 UI。

## User Stories

1. As a new visitor on the marketing homepage, I want example brief chips next to the prompt, so that I can start with a concrete idea without inventing copy from scratch.
2. As a logged-in user with an empty Workspace, I want the same example briefs and a soft credits promise, so that I know roughly what the welcome pack buys.
3. As a user about to Generate for the first time, I want to be nudged through existing vibe / intent clarification with a clear skip path, so that my first generate is more likely to land without feeling trapped.
4. As a user waiting on first generate, I want human-readable pipeline chapter titles, so that the wait feels like progress rather than a black box.
5. As a user whose preview first becomes ready, I want a non-blocking tip that Design Mode is on and I can click any text to edit, so that I learn the free edit path immediately.
6. As a user who successfully Direct-Applies once, I want step 2 and onboarding to complete, so that chrome gets out of the way.
7. As a user who cannot use Direct Apply (`directEditCapable=false`), I want step 2 to explain that pick-edit is unavailable, without redefining onboarding-complete as “preview only”.
8. As a user who dismisses onboarding, I want it never to return on this account, so that I am not nagged across devices.
9. As a product analyst, I want funnel events including first modify (no UI), so that we can measure onboarding complete vs deep activation separately.
10. As a user, I do not want Remix mentioned in onboarding, so that incomplete Remix does not become a dead-end CTA.

## Implementation Decisions

### Product rules (locked)

| Rule | Value |
|------|--------|
| Onboarding complete | Previewable project exists **and** ≥1 successful Design Mode Direct Apply |
| Deep activation | ≥1 Modify send — **observe only**, no nudge UI in v0.1 |
| Remix | **Out** of all onboarding surfaces/copy |
| Empty / marketing CTA | Primary prompt + **4–5 curated example briefs** (i18n), chips write into input |
| Soft gate | Reuse Intent + vibe picker; recommend; always allow skip |
| Generate theater | Human chapter titles only; no mid-run preview flashes |
| Design first lesson | Non-blocking tip; auto-enable Design Mode; any successful Direct Apply completes |
| Progress chrome | Studio-only 2-step bar; manual “don’t show again” |
| Lifecycle | Per-`user_id`; hide forever after complete or dismiss |
| Storage | Server-side user preferences (no localStorage-only) |
| Credits copy | Soft promise aligned with welcome 12 (≈1 generate + a few edits; actual may vary) |
| Surfaces | Marketing `HeroPrompt` + Workspace empty: chips (+ credits soft copy on logged-in empty); Studio: steps + tip + chapters |

### Preference shape (conceptual)

Minimal server JSON (or columns) keyed by `user_id`, e.g.:

```ts
{
  dismissed: boolean;       // “不再显示”
  generateDone: boolean;    // step 1 — previewable generate observed
  designModeDone: boolean;  // step 2 — successful Direct Apply
}
```

`onboardingComplete = dismissed || (generateDone && designModeDone)` for UI visibility. Analytics may still record whether complete was via dismiss vs success.

There is **no** existing user-preferences table in-repo today — this PRD requires adding a minimal preference store (table/column/API) rather than inventing a second ad-hoc flag system.

### Analytics (required)

Use existing `trackEvent` (`lib/analytics/client.ts`). Ship at least:

| Event | When |
|-------|------|
| `onboarding_chip_click` | Example brief chip selected |
| `onboarding_step_view` | 2-step bar / tip shown (include step id) |
| `onboarding_generate_started` | First generate start while onboarding active |
| `onboarding_generate_preview_ready` | First previewable ready while onboarding active |
| `onboarding_design_complete` | First successful Direct Apply that completes step 2 |
| `onboarding_dismiss` | User chooses don’t-show-again |
| `first_modify_send` | First Modify send for user (side observation; no onboarding UI) |

Reuse/correlate with existing `design_mode_direct_patch`, `preview_open` where helpful; do not rely on them alone for onboarding attribution.

### Modules / seams

1. **Primary**: user onboarding preference read/write + “should show onboarding chrome” helper.  
2. **UI**: example brief chips on `HeroPrompt` (marketing + dashboard empty); Studio 2-step bar + Design Mode tip; generate chapter title copy.  
3. **Hooks**: preview-ready → mark `generateDone`, auto-enable Design Mode + tip; Direct Apply success → mark `designModeDone`.  
4. **Analytics**: thin wrappers around `trackEvent` at the above moments.

### Copy / i18n

- Example briefs: curated static list (zh + en), product-owned; suggest covering local service, SaaS marketing, portfolio, event landing, brand narrative.  
- Credits soft promise near empty-state prompt (logged-in).  
- Do not invent hard “N generates left” guarantees.

## Testing Decisions

### What makes a good test

- Prefer pure helpers: visibility (`shouldShowOnboarding`), completion transitions, preference merge/idempotency.  
- UI: chip writes prompt value; dismiss/complete hide chrome.  
- Do not require full Playwright generate in default CI for onboarding chrome.

### Suggested cases

- New user prefs empty → show chips (where applicable) and Studio steps after project exists.  
- `designModeDone` true → no tip / steps.  
- `dismissed` true → no chrome even if steps incomplete.  
- Direct Apply success flips `designModeDone` once (idempotent).  
- `directEditCapable=false` → step 2 copy explains unavailable; does not auto-set `designModeDone`.  
- Chip click sets textarea to brief text and fires `onboarding_chip_click`.

### Prior art

- `lib/analytics/client.ts` + `design_mode_direct_patch` in `useDesignMode`  
- `HeroPrompt` placeholders / pending-build resume  
- Credits welcome soft-promise copy on `/pricing`

## Out of Scope

- Remix CTAs, Remix tours, Community-copy-as-start  
- Modify nudge / deep-activation UI  
- Full generate theater (mid-run preview flashes, cinematic staging)  
- Blocking modals / forced tours  
- Per-project re-onboarding  
- Hard credit-count guarantees  
- Separate newbie-only calibration UI (must reuse Intent / vibe)  
- Deploy / Feishu / BoardRun teaching  
- Publish Preview / share as onboarding steps  
- Migrating historical users with special campaigns (optional later)

## Success metrics (product)

| Metric | Definition |
|--------|------------|
| Onboarding completion rate | Users with `designModeDone` / users who started first generate (exclude pure dismiss if analyzing quality) |
| First preview rate | `onboarding_generate_preview_ready` / started |
| Chip assist rate | chip click → project create |
| Deep activation (observe) | `first_modify_send` among onboarding-complete users |

## Grilling lock table

| # | Decision |
|---|----------|
| 1 | Primary success = previewable generate + Design Mode Direct Apply |
| 2 | Design Mode = onboarding complete; Modify = deep activation (observe only) |
| 3 | No Remix in onboarding |
| 4 | Empty/marketing = prompt + curated example brief chips |
| 5 | Soft gate: vibe + ≤3 questions, skippable; reuse Intent/vibe |
| 6 | Design lesson: non-blocking tip; auto Design Mode; any Direct Apply |
| 7 | Studio 2-step bar only; dismissible |
| 8 | User-scoped; complete or dismiss → gone forever |
| 9 | No Modify push in v0.1 |
| 10 | Theater = human chapter titles only |
| 11 | Credits soft promise in onboarding copy |
| 12 | Auto Design Mode + any Direct Apply; incapable → explain, don’t redefine complete |
| 13 | Server user preferences |
| 14 | Curated static briefs + i18n |
| 15 | Surfaces: marketing + Workspace chips; Studio steps/tip/chapters |
| 16 | Analytics set C (incl. `first_modify_send`) |
| 17 | Soft gate reuses existing Intent/vibe UI |
| 18 | Consensus locked — this PRD |

## Further Notes

- Example chips **complement** existing rotating `HeroPrompt` placeholders; they do not replace them.  
- After ship: optional short `docs/product/new-user-onboarding-v0.1.md` mirror; no `CONTEXT.md` glossary term required unless a named product surface ships (e.g. “Onboarding checklist”).  
- Suggested issue split: `01` preference store + API; `02` chips + credits copy; `03` Studio steps + Design tip + hooks; `04` generate chapter copy; `05` analytics events.

## Comments

- Grilling completed 2026-07-15; user confirmed shared understanding (Q18 = A).
