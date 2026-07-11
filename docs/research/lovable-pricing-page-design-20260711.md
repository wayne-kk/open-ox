# 调研：Lovable Pricing 页设计与转化结构（2026-07-11）

**状态**：完成（第一方：live pricing FAQ 文案 + docs；营销卡区为客户端渲染，结构据公开 FAQ/docs 交叉核对）  
**日期**：2026-07-11  
**问题**：Lovable `/pricing` 如何组织信息架构与视觉语言？Open-OX `/pricing` 应学什么、刻意不抄什么？

**范围**：页面设计 / IA / FAQ / 转化模式。积分经济学见 `docs/research/ai-builder-credits-pricing-20260711.md`。

---

## 1. 结论摘要

| 缝 | Lovable | 对 Open-OX 的含义 |
|----|---------|-------------------|
| **首屏** | 居中标题「Pricing」+ 一句容量导向副文案 | 不要用「Credits」小标签 + 左对齐长文；首屏只做定价决策 |
| **计划呈现** | Free / Pro / Business / Enterprise；Pro/Business **按月额度档位卖 credits** | 合并多个 Pro 价卡为 **一张 Pro + 额度选择器** |
| **计费切换** | Monthly / Annual（年付折扣） | v0.2 可只展示 Monthly；UI 预留 Annual |
| **FAQ** | 定价页下方大块 FAQ（credit 是什么、过期、座位等） | 必做；降低「积分焦虑」 |
| **视觉** | 营销站干净、卡片对比清晰、主 CTA 明确 | 去掉霓虹 glow、四列挤卡、uppercase micro-label |
| **不按 seat** | 文案强调 credits 池而非人头 | Open-OX 暂单用户，仍可写「按积分容量」 |

**一句话**：Lovable 定价页是 **「容量商品」展示**（选多少 credits），不是功能矩阵墙；FAQ 承担教育，卡片只负责选档与付款。

---

## 2. 信息架构（live + FAQ）

来源：[https://lovable.dev/pricing](https://lovable.dev/pricing)

观察到的区块顺序：

1. 营销顶栏（Solutions / Resources / … / Pricing / Log in / Get started）
2. **Pricing** 标题 + *Start for free. Upgrade to get the capacity that exactly matches your team's needs.*
3. 计划卡区（客户端渲染；docs 确认档位为 Free / Pro / Business / Enterprise）
4. **Frequently asked questions**（长列表，可展开）
5. Related articles → Plans and credits
6. 全站 footer

FAQ 主题覆盖（同页）：

- What is a credit?
- How do I use credits?（含 Plan mode=1、Build 按复杂度示例表）
- Do credits expire?
- What happens if subscription ends?
- Free vs paid 包含什么
- Team / seat（不按座位收费）
- Cloud 运行成本
- Business 为何更贵
- 代码所有权、学生折扣

来源：同上 pricing 页 FAQ 正文。

---

## 3. 计划与额度选择（docs）

来源：[https://docs.lovable.dev/introduction/subscription-plans](https://docs.lovable.dev/introduction/subscription-plans)

- Pro/Business：**同一计划名 + 月 credits 档位**（100 起，可升到 10,000），价格随档位变
- Annual billing：折扣月价 + 更高 rollover
- Free：日 5 build credits，月封顶 30

**设计含义**：UI 上不应把 Pro 100 / Pro 200 / Pro 400 拆成三张同级卡（Open-OX 旧页问题）；应 **一张 Pro 卡内选容量**。

---

## 4. 视觉与转化模式（可观察模式）

从定价页公开结构与同类 SaaS 惯例（结合 Lovable 文案语气）：

| 模式 | 做法 |
|------|------|
| 标题层级 | 一个 H1「Pricing」，副文案一句讲 capacity |
| 卡片 | 少列（3–4）、等高、主计划轻微强调，避免多色 glow |
| CTA | Free → Get started；Paid → Get started / Upgrade；Enterprise → Contact |
| 教育 | 卡片外用 FAQ，不在卡内塞长解释 |
| 信任 | 所有权、不按 seat、过期规则写进 FAQ |

刻意避免（Open-OX 旧页）：

- 四列挤满 + 每卡重复两条相同 bullet
- 「Credits」eyebrow + Sparkles 图标
- 高饱和 sky glow 描边
- Top-up 与主计划同权重抢视线

---

## 5. Open-OX 应抄 / 不抄

**抄**

- 居中 Pricing 首屏 + capacity 副文案
- Free | Pro（内嵌额度选择）| Enterprise
- 下方 FAQ（credit / 过期 / Design Mode 免费 / top-up）
- Top-up 降权为次级区块

**不抄**

- Business 双倍价轨（Open-OX 尚无团队治理）
- Cloud/AI grant 三余额叙事（Open-OX v0.2 仅 AI build）
- 浅色珊瑚营销皮肤（保持 Open-OX 深色品牌，但降噪）

---

## 6. 来源

- https://lovable.dev/pricing
- https://docs.lovable.dev/introduction/subscription-plans
- https://docs.lovable.dev/introduction/credits-and-usage
