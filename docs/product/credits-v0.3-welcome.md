# Credits v0.3 — Welcome pack Free tier

**状态**：已落地（替换 Free 日发）  
**前置**：[credits-v0.1.md](./credits-v0.1.md) · [credits-v0.2-stripe.md](./credits-v0.2-stripe.md)  
**PRD**：[`.scratch/credits-welcome-grant/PRD.md`](../../.scratch/credits-welcome-grant/PRD.md)

## 目标

Free 试用改为**注册/首次 ensure 一次性 12 credits**，用完硬停并导向 `/pricing`；付费路径（Pro / top-up）不变。

## 行为摘要

| 规则 | 值 |
|------|-----|
| 欢迎礼 | 12 credits，幂等键 `welcome:{userId}` |
| 老 Free 迁移 | 未付费且余额 &lt; 12 → 补到 12（`welcome_migrate_v3:{userId}`） |
| 日发 | 已移除 |
| Generate 门禁 | ≥ 8 |
| Modify 门禁 | ≥ 0.5 |
| Generate 扣费 | 仅 `success`（可预览产物） |
| 超额 | 扣到 0，不记债，不中断 run |
| 免费动作 | Design Mode 本地、Remix 拷贝、Publish |

## 启用

与 v0.1/v0.2 相同：`CREDITS_ENABLED=1` + 既有迁移。无需新 Stripe price。
