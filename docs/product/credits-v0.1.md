# Credits v0.1

**状态**：已落地（核心计量 / 账本 / 门禁；默认关闭）  
**Free 档后续变更**：日发已由 [credits-v0.3-welcome.md](./credits-v0.3-welcome.md) 替换为注册欢迎礼 12。  
**调研**：[docs/research/ai-builder-credits-pricing-20260711.md](../research/ai-builder-credits-pricing-20260711.md)

## 目标

为 Generate / Modify 引入用户可见的 **积分（credits）** 消耗：按实际 LLM 成本折算，Free 档日/月帽，用尽可硬停。

## 范围（v0.1）

- 余额挂在 **`user_id`**（当前无多成员 workspace 表；产品「Workspace」= 用户私有面）
- 计量：gateway 内 AsyncLocalStorage 累加 token → USD → credits
- 扣费：generate 成功；modify turn 结束（含 conversation/plan-only）
- 不扣费：Design Mode 纯本地写回；remix 拷贝；publish
- Free：每日 5、月累计发放封顶 30；日额度不滚到次日
- `CREDITS_ENABLED=1` 时才强制门禁与扣费；未开则只做 no-op（便于本地开发）

## 不做（本版）

- ~~Stripe / Pro 订阅 / top-up UI~~ → 见 [credits-v0.2-stripe.md](./credits-v0.2-stripe.md)
- 团队共享池
- 托管 Run 积分
- ~~定价营销页~~ → `/pricing`

## 公开缝（测试与调用）

| 模块 | 行为 |
|------|------|
| `lib/billing/credits.ts` | USD ↔ credits、Free 日/月帽常量 |
| `lib/billing/modelPricing.ts` | 模型 token 单价 → USD |
| `lib/billing/usageContext.ts` | 一次 run 内累加 LLM usage |
| `lib/billing/account.ts` | ensure 日发放、查余额、spend、canAfford |

## 启用步骤

1. 应用迁移：`supabase/migrations/026_user_credits.sql`
2. `.env` 设置 `CREDITS_ENABLED=1`
3. （可选）调 `CREDITS_USD_PER_CREDIT` / `CREDITS_MARGIN`
4. 侧栏在启用后显示余额；`GET /api/credits` 可查

## 扣费挂点

| 路径 | 行为 |
|------|------|
| `POST /api/ai` | 门禁：余额 ≥ 2 |
| `executeGenerationRun` | run 结束后按累加 usage 扣费 |
| `POST .../modify` | 门禁：余额 ≥ 0.5；turn 结束后扣费；SSE `credits` 事件 |
| Design Mode 本地写回 | 不经过 LLM gateway → 不扣费 |
