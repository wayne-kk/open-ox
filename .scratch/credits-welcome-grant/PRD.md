# Credits Welcome Grant — Free 试用改为注册送积分

Status: ready-for-agent

**日期**：2026-07-14  
**来源**：grilling 共识（注册送积分，非次数券）  
**前置**：Credits v0.1 计量/账本/门禁；Credits v0.2 Stripe Pro / top-up / `/pricing`  
**术语**：[`CONTEXT.md`](../../CONTEXT.md)（Credits、Workspace、Generate、Modify、Design Mode、Remix）  
**产品对照**：[`docs/product/credits-v0.1.md`](../../docs/product/credits-v0.1.md)、[`docs/product/credits-v0.2-stripe.md`](../../docs/product/credits-v0.2-stripe.md)

---

## Problem Statement

Free 用户今天靠「每日发积分」续命，试用边界模糊，也和「进来认真试一次生成、改几轮，然后充值再继续」的产品目标不一致。用户需要一次清晰、可预期的欢迎额度；用完后 LLM 类动作硬停并导向充值，同时仍能预览、浏览历史、做 Design Mode 本地改动。

## Solution

关掉 Free 日发。新用户在首次确保积分账户时一次性获得 **12 credits**（不过期）。对外软承诺「约可完整生成 1 次，并再改几轮（以实际消耗为准）」；账本仍按真实 LLM 成本扣费。Generate 开跑门槛提高到 **8**；Modify 仍为 **0.5**。有可打开预览/产物才扣 Generate；否则不扣（全额退等价于不结算）。跑中允许扣到 0、不记债、不中断。余额不足时硬停并导向 `/pricing`。Remix / Publish / Design Mode 本地写回继续免费。

## User Stories

1. As a newly registered user, I want 12 credits credited once when my credit account is first ensured, so that I can try Generate and a few Modify turns without paying first.
2. As a Free user, I want daily free grants to stop, so that my trial is a one-shot welcome pack rather than an infinite drip.
3. As a Free user, I want welcome credits never to expire, so that I can come back later and still finish my trial.
4. As a returning Free user who never paid and whose balance is below 12, I want a one-time top-up to 12, so that I am aligned with the new welcome waterline.
5. As a Pro or top-up customer, I want my balance and plan untouched by the Free migration, so that paid value is preserved.
6. As a user who already received the welcome grant, I want a second ensure/login not to grant another 12, so that the welcome gift is idempotent per `user_id`.
7. As a user browsing the product, I want copy that says roughly “enough for about one full generate and a few edits (actual usage may vary)”, so that I understand the trial without a hard count guarantee.
8. As a user about to Generate, I want the gate to require at least 8 credits, so that I cannot start a full site build on a near-empty balance that would force the platform to absorb most of the cost.
9. As a user about to Modify, I want the gate to require at least 0.5 credits, so that small remaining balances can still fund light edits.
10. As a user whose Generate run fails to produce a previewable project, I want no credits charged for that run, so that a broken first generate does not burn my trial.
11. As a user whose Generate run produces a previewable project (including if I cancelled after a usable preview existed), I want credits charged for actual LLM usage (capped at my balance), so that delivered value is paid for from my trial/paid balance.
12. As a user finishing a Modify turn, I want credits charged for actual LLM usage (capped at my balance), so that edits are metered fairly even when the turn fails mid-way.
13. As a user mid-run whose true usage exceeds remaining balance, I want the run to complete, my balance to hit 0, and no debt recorded, so that I still get the result and am nudged to top up next.
14. As a user with balance below the Generate gate but above the Modify gate, I want to still Modify (and not start a new Generate), so that leftover trial credits remain useful.
15. As a user who cannot afford Generate or Modify, I want a hard stop with a clear path to `/pricing`, so that I know how to continue.
16. As a user who is hard-stopped on LLM actions, I want preview, project history, and Design Mode local writeback to keep working, so that I am not locked out of my site.
17. As a user Remixing a Community project, I want the copy itself to cost 0 credits, so that discovery and remix stay frictionless.
18. As a user Publishing a preview, I want publish not to spend credits, so that shipping a preview is not gated by AI balance.
19. As a user on the pricing page, I want Free tier copy to describe the one-time 12-credit welcome (not daily 5 / monthly 30), so that marketing matches reality.
20. As a user viewing the sidebar credit badge, I want to see my real balance and link to `/pricing`, so that I can top up when low.
21. As a developer with `CREDITS_ENABLED` off, I want grants/gates/charges to remain no-ops, so that local development stays unblocked.
22. As an admin looking at a user, I want to still see plan and balance, so that support can explain trial vs paid state.
23. As the business, I want welcome grants keyed only by `user_id` (no email/device dedupe in this version), so that we ship simply and accept multi-account abuse risk for now.
24. As the business, I want Stripe Pro subscriptions and top-up packs to keep working unchanged, so that paid conversion paths do not regress.
25. As a user who cancels Pro, I want remaining balance kept and Free daily grants NOT to resume, so that post-cancel behavior matches the new Free model (welcome already consumed or migration top-up rules only).

## Implementation Decisions

### Primary test seam (preferred: one seam)

**Credits account lifecycle** in the billing domain — the same public surface already used by gates and charge hooks:

- Ensure account + **welcome grant** (replace Free daily grant)
- `canAfford` against updated minimums
- Post-run **spend capped at balance** (never fail the user-visible run for insufficient funds after the gate passed)
- Pure helper for **whether a Generate run is billable** (previewable deliverable or not)

HTTP routes (`POST /api/ai`, modify route) and `executeGenerationRun` / modify turn completion should stay thin adapters that call this seam. Prefer not to scatter welcome/migration/clamp logic across UI.

UI/copy (`/pricing`, i18n, insufficient-credit CTA) is a secondary seam: assert copy and hard-stop navigation, not ledger math.

### Product rules (locked)

| Rule | Value |
|------|--------|
| Welcome amount | 12 credits, once per `user_id` |
| Welcome timing | First ensure of credit account (idempotent ledger key e.g. `welcome:{userId}`) |
| Welcome expiry | None |
| Free daily grant | Removed |
| Legacy Free migration | One-time: `plan=free`, never paid (no successful Stripe grant history / not pro), `balance < 12` → set balance to 12 (ledger adjust); do not add 12 on top if already ≥ 12 |
| Anti-abuse | `user_id` only |
| Marketing | Soft promise only |
| `MIN_GENERATE` | 8 |
| `MIN_MODIFY` | 0.5 |
| Generate charge | Only if previewable deliverable exists; else charge 0 |
| Modify charge | Always meter actual usage (still capped at balance) |
| Overage | `charged = min(usage, balance)`; balance ≥ 0; no debt; do not cancel run |
| Hard stop UX | Block LLM start → `/pricing`; keep preview / history / Design Mode local |
| Free actions | Remix copy, Publish, Design Mode local writeback |

### Modules / interfaces (conceptual)

- **Credits constants**: welcome amount; raise generate minimum; remove or stop using daily/monthly Free grant constants for runtime behavior.
- **Account ensure path**: stop applying daily Free grant; on ensure, attempt idempotent welcome grant for accounts that never received it; apply legacy top-up-to-12 once for eligible Free users (flag in account or ledger idempotency key e.g. `welcome_migrate_v3:{userId}`).
- **Grant kinds**: extend grant API / ledger `kind` for welcome (e.g. `grant_welcome`) and migration adjust; reuse existing idempotency-key pattern from Stripe grants.
- **Spend path**: post-run charge must **clamp** to current balance instead of returning `INSUFFICIENT` and charging 0 while usage was positive (today’s failure mode under-charges or no-ops after the fact). Gate before start still uses `canAfford(min)`.
- **Generate billability**: decide charge using deliverable signal already available at end of generation (e.g. successful ready project / previewable outcome). Failed or non-deliverable runs → do not call spend (or spend 0). Align with glossary: Generate vs Design Mode vs Remix.
- **Cancel-after-preview**: if a usable preview/产物 exists, treat as billable even if the user cancelled afterward.
- **Stripe / Pro**: no catalog price changes required; cancel → `plan=free` keeps balance; do **not** re-enable daily grant.
- **Copy**: update pricing Free tier strings and FAQs that mention daily 5 / monthly 30 / daily expiry; changelog note optional.
- **Schema**: prefer ledger idempotency + existing account columns; add a boolean/timestamp on `user_credit_accounts` only if needed for welcome/migration clarity (e.g. `welcome_granted_at`). Avoid keeping dead daily-grant write paths active.
- **Feature flag**: keep `CREDITS_ENABLED` behavior.

### Generate failure / refund (operational definition)

Bill Generate iff the run left the user with an openable preview / project artifact suitable for Studio use. Otherwise do not debit. This replaces “always charge accumulated usage at end of generate” for non-deliverable outcomes.

### Migration note for cancel-subscription FAQ

Existing FAQ text that says cancel returns users to Free **daily** grants must be updated to the welcome-only Free model.

## Testing Decisions

### What makes a good test

- Test **external behavior** of the billing seam: balances, ledger idempotency, gate booleans, charged amounts, and billable vs non-billable generate outcomes.
- Do not assert internal SQL shapes or private helpers beyond the seam’s exported API.
- Prefer pure functions (welcome eligibility, migration top-up amount, spend clamp, generate billability) plus existing unit-test style in billing (see prior art below).
- Integration against real Stripe is out of scope for this PRD’s automated tests; do not break existing grant idempotency tests for top-up/subscription.

### Modules under test

1. **Primary**: billing account/grant/spend/credits constants — welcome grant once; no daily grant; migration top-up-to-12; `canAfford` with min 8 / 0.5; spend clamps to balance; generate billability helper.
2. **Adapter smoke (lightweight)**: generate charge path skips debit when non-billable; modify still debits (clamped).
3. **Copy (optional / snapshot)**: pricing Free strings no longer claim daily 5 / monthly 30.

### Prior art

- `lib/billing/credits.test.ts` — constants and `usdToCredits`
- `lib/billing/freeGrant.test.ts` — pure grant state machine (daily grant tests should be removed or replaced with welcome/migration pure tests)
- `lib/billing/catalog.test.ts` — catalog shape
- Gate usage today: `canAfford` in generate and modify API routes; charge via `chargeUsageForRun`

### Suggested cases (non-exhaustive)

- First ensure → balance 12, ledger welcome once; second ensure → no second grant
- Free user balance 3, unpaid → migration brings to 12 once; second ensure → no change
- Free user balance 15 → migration leaves 15
- Pro user → no welcome clobber; no daily grant
- `canAfford(8)` false at balance 7.9; `canAfford(0.5)` true
- Spend request 10 with balance 4 → charged 4, balance 0, ok
- Generate non-deliverable → charged 0 despite positive usage accumulator
- Generate deliverable with usage 10, balance 12 → charged 10, balance 2
- `CREDITS_ENABLED` off → gates open, no ledger writes

## Out of Scope

- Action-ticket model (1 generate + 3 modifies as hard counts)
- Email / device / payment-fingerprint anti-abuse
- Welcome credit expiry / separate welcome vs paid buckets
- Mid-run cancellation for low balance; debt / negative balance
- Dynamic pre-auth hold / estimated pre-debit
- Changing Stripe price IDs or Pro/top-up pack sizes
- Team / workspace shared credit pools
- Charging Remix, Publish, or Design Mode local writeback
- Hosted runtime / preview bandwidth credits
- Forcing email verification before welcome grant

## Further Notes

### Seams check (for human)

Proposed **single primary seam**: Credits account lifecycle (ensure / welcome / migrate / canAfford / clamp-spend / generate-billable). Confirm this matches expectations before splitting work across routes or UI.

### CONTEXT.md

After ship, update the Credits glossary bullet: Free = one-time welcome 12 (not daily grant + monthly cap). Point at this PRD and a short `docs/product/credits-v0.3-welcome.md` if product docs are mirrored.

### Grilling lock table

| # | Decision |
|---|----------|
| 1 | Free = registration one-shot only; no daily grant |
| 2 | 12 credits |
| 3 | Generate: no deliverable → no charge; Modify: actual cost |
| 4 | Legacy unpaid Free with balance &lt; 12 → top up to 12 once |
| 5 | Anti-abuse: `user_id` only |
| 6 | Soft marketing promise |
| 7 | Complete run; clamp to 0; no debt |
| 8 | Deliverable = openable preview / artifact |
| 9 | MIN_GENERATE = 8; MIN_MODIFY = 0.5 |
| 10 | Welcome does not expire |
| 11 | Grant on first ensure (idempotent) |
| 12 | Hard stop → `/pricing`; Design Mode local / preview / history OK |
| 13 | Remix free |

## Comments

- Published from grilling + `/to-prd` on 2026-07-14.
