# Credits v0.2 — Stripe / Pro / top-up / pricing

**状态**：已落地（需配置 Stripe + 迁移 027）  
**前置**：[credits-v0.1.md](./credits-v0.1.md) · [调研](../research/ai-builder-credits-pricing-20260711.md)

## 范围

- **Pro 订阅**：Checkout `mode=subscription`；档位 Pro 100 / 200 / 400（$25 / $50 / $100）
- **Top-up**：Checkout `mode=payment`；50 / 100 / 200 credits
- **Webhook**：`checkout.session.completed`、`invoice.paid`、`customer.subscription.updated|deleted`
- **定价页**：`/pricing`
- **Portal**：管理订阅 / 取消

## 行为

| 事件 | 入账 |
|------|------|
| 订阅 Checkout 成功 | `plan=pro` + 当月额度 ADD（幂等） |
| `invoice.paid` | 续费月额度 ADD（幂等 `invoice:{id}`） |
| Top-up Checkout | credits ADD |
| 订阅取消 | `plan=free`；余额保留；次日 Free 日发不抹掉高于日额度的余额 |

## 启用

1. 迁移 `026_user_credits.sql` + `027_stripe_billing.sql`
2. Stripe Dashboard 创建 recurring prices + one-time prices，写入 `.env`（见 `.env.example`）
3. Webhook endpoint：`POST /api/billing/webhook`（事件见上）
4. `CREDITS_ENABLED=1` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
5. `NEXT_PUBLIC_APP_URL` 指向可回调的站点根

## API

| 路由 | 作用 |
|------|------|
| `GET /api/billing/catalog` | 公开档位（含 price 是否已配置） |
| `POST /api/billing/checkout` | `{ kind: "subscription", tierId }` 或 `{ kind: "topup", packId }` → `{ url }` |
| `POST /api/billing/portal` | Customer Portal URL |
| `POST /api/billing/webhook` | Stripe 签名校验 + 入账 |

## 本地测 Webhook

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```
