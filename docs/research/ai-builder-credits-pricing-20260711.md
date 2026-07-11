# 调研：AI Builder 积分消耗与 Pricing（2026-07-11）

**状态**：完成（基于第一方公开材料：pricing 页、官方 docs、help center、产品博文）  
**日期**：2026-07-11  
**问题**：同类型 AI 建站/应用生成器如何设计「计费单位、订阅档、消耗动作、超额、团队池」？Open-OX 若做积分消耗与 price，应学什么、刻意不抄什么？

**范围说明**：对标 **Lovable、Bolt、v0（Vercel）、Replit Agent**。不展开通用 ChatGPT/Claude 订阅。不把二手评测博客当主证据。

---

## 1. 结论摘要

| 维度 | Lovable | Bolt | v0 | Replit Agent |
|------|---------|------|----|--------------|
| **对外单位** | **Credits**（统一余额） | **Tokens**（LLM 文本单位） | **Credits**（美元面额的预付余额） | **Credits**（美元面额；Agent 按 effort） |
| **扣费模型** | Plan=固定 1 credit/消息；Build=按复杂度加权 | 按实际 token（含同步整个项目文件） | 按 input/output token → 折算 credits；模型价不同 | Effort-based：按任务工作量；Plan/Build 都计费 |
| **订阅骨架** | Free / Pro / Business / Enterprise；Pro/Business 按月额度档位卖 credits | Free / Pro / Teams / Enterprise | Free / Team / Business / Enterprise（Premium 对新用户 sunset） | Starter / Core / Pro / Enterprise |
| **入门价（公开页）** | Pro 从 **$25/月 · 100 credits** | Pro **$25/月 · 起 10M tokens** | Team **$30/user/月 · $30 credits/user** | Core **$25/月（年付约 $20）· $25 credits** |
| **免费档** | 5 build credits/天，月封顶 30；另有 Cloud/AI grant | 1M tokens/月 + **300K/天** 硬帽 | **$5** 月额度 + **7 messages/天** | 每日 Agent 额度 + 有限 cloud credits；1 个 published app |
| **超额** | 硬停 build；可 top-up / auto top-up（付费档） | 升级档位或（高档 Pro）reload tokens | 生成暂停；付费档可买更多 credits | 可用 credit packs；可设 budget；超出可走 pay-as-you-go（产品 FAQ 语境） |
| **余额归属** | **Workspace 共享池**；可设 per-member 月限额 | Teams：**按 seat 分额度，不共享** | Team/Business：个人月额度 + **Shared Credit Pool** | Pro：**builders 池化 credits**；Core 更偏个人订阅额度 |
| **Rollover** | 付费月额度可滚（月付约 2 个月有效） | 付费：多滚 1 个月（共约 2 个月） | 未用月额度可滚，**65 天后过期** | Core 不滚；Pro 多滚 1 个月 |
| **消耗可见性** | 消息三点菜单看精确 cost；Settings 用量明细；credit bar | Subscription 页看余额/rollover | Usage 日志（日期/用户/事件/模型/cost） | Checkpoint 上 hover 看 cost；Usage dashboard |

**一句话**：行业已从「固定每条消息价」迁到 **「用户可见抽象单位（credit）+ 内部按工作量/token 加权」**；订阅卖的是 **月额度桶**，超额靠 **加量包 / 自动充值 / 硬停**；团队要么 **共享池（Lovable/v0/Replit Pro）**，要么 **按 seat 分桶（Bolt Teams）**。

---

## 2. Lovable

### 2.1 单位与覆盖范围

- 对外单位：**credit**。
- 一个余额覆盖三类用量：
  - **Build**：在 Lovable 里 plan / generate / edit / update
  - **Cloud**：Lovable Cloud 托管与运行（DB、网络、存储、Edge Functions、Realtime）
  - **AI gateway**：已部署应用内的模型调用
- 正在 rollout「单一 credit 余额」；旧 Cloud/AI 美元余额按 plan credit rate 折算进 credits。

来源：https://docs.lovable.dev/introduction/credits-and-usage

### 2.2 额度来源与消耗顺序

1. **Usage-specific grants**（先扣）：每日 build credits；月 Cloud grant；月 AI grant —— **不 rollover**。
2. **General credits**（后扣）：月订阅额度、top-up、bonus —— 优先用临近过期的。

| Plan | Daily build | Monthly Cloud grant | Monthly AI grant |
|------|-------------|---------------------|------------------|
| Free | 5/天，月封顶 30 | 20 | 4 |
| Pro / Business | 5/天（无月封顶） | 20 | 4 |

来源：https://docs.lovable.dev/introduction/credits-and-usage · https://docs.lovable.dev/introduction/subscription-plans

### 2.3 Build 扣费粒度（核心）

| Mode | 计费 |
|------|------|
| **Plan mode** | 每条消息 **固定 1 credit**；不改代码 |
| **Build mode** | **按复杂度/完成工作量**；示例：改按钮灰 ~0.50、去 footer ~0.90、加 auth ~1.20、带图落地页 ~2.00（docs 标明为 illustrative） |

- 中止的 Build 请求按已完成工作收费。
- 聊天里每条回复的三点菜单可看 **exact cost**。

来源：https://docs.lovable.dev/introduction/credits-and-usage · https://docs.lovable.dev/features/plan-mode · https://docs.lovable.dev/features/agent-mode.md

### 2.4 Preview / 轻量编辑（与 credits 的边界）

| 模式 | 计费（docs） |
|------|--------------|
| Select elements → 自然语言改 | 标准 chat，耗 credits |
| Draw annotation → 发消息 | 标准 chat，耗 credits |
| Edit text inline | 每日 **100 次免费**/用户，超出耗 workspace credits；配额每 24h 重置 |
| Add a comment | 钉评论免费；把 comment thread 发给 Lovable 耗 credits |

来源：https://docs.lovable.dev/features/preview-toolbar

### 2.5 订阅与 top-up

- **Pro**：月额度从 100 credits 起，月付 **$25**（100 档）起，可升到 10,000（$2,250）；年付有折扣。
- **Business**：同额度档位约 **2× 价**（100 档 $50），换治理能力（SSO、RBAC 等）。
- **按 credits 卖，不按 seat**；workspace 成员数 unlimited。
- Top-up：Pro **$15 / 50 credits（$0.30）**；Business **$30 / 50（$0.60）**；有效期 12 个月；支持 auto top-up + 月 spend limit。
- 用尽：build **硬停**；依赖 Cloud/AI 的已部署 app 可 pause。

来源：https://docs.lovable.dev/introduction/subscription-plans · https://docs.lovable.dev/introduction/credits-and-usage

### 2.6 团队与可见性

- Credits 属 **workspace**，成员共享。
- Owners/admins 可设 **default monthly credit limit** 与 **per-member overrides**。
- Usage details：按 Build / Run、项目、人过滤；角色决定能否看他人用量。

来源：https://docs.lovable.dev/introduction/credits-and-usage · https://lovable.dev/faq/billing/plans/pricing-justification

---

## 3. Bolt（bolt.new / StackBlitz）

### 3.1 单位与扣费逻辑

- 对外单位：**tokens**（标准 LLM token 语义）。
- Docs 明确：大部分消耗来自 **把项目文件系统同步给 AI**；项目越大，每条消息越贵。
- 因此是 **usage-proportional**，不是固定「每 prompt 一价」。

来源：https://bolt.new/pricing · https://support.bolt.new/account-and-subscription/tokens

### 3.2 订阅档（pricing 页）

| Plan | 价 | Token 额度（公开页） | 其他 |
|------|----|---------------------|------|
| Free | $0 | **1M / 月** + **300K / 天** | Bolt branding、10MB upload |
| Pro | **$25 / 月** 起 | **起 10M / 月**，无日限额 | 自定义域、token rollover、更大 upload |
| Teams | **$30 / 月 / member** | 每成员月额度（同 Pro 能力） | 集中账单、admin、私有 NPM 等 |
| Enterprise | Custom | Custom | SSO、审计、SLA |

来源：https://bolt.new/pricing

### 3.3 Rollover、reload、Teams 池

- 付费订阅 token 自 2025-07-01 起可 **多滚 1 个月**（合计约 2 个月有效）；需保持付费订阅。
- Free **不** rollover。
- 最高档月付 Pro 或任意年付 Pro 可 **Reload tokens**；reload **不过期**；单价随档位变化。
- Teams：**tokens 按成员分配，不在成员间共享**；rollover 也绑在个人。

来源：https://bolt.new/pricing · https://support.bolt.new/account-and-subscription/tokens

### 3.4 对 Open-OX 的含义

Bolt 把「上下文膨胀」直接暴露给用户（token），诚实但难预测。Open-OX 若上下文也会随项目变大，更适合 **credit 抽象 + 事后精确扣费**，而不是让用户心算 token。

---

## 4. v0（Vercel）

### 4.1 单位与计量

- 对外：**credits**，表现得像 **预付美元余额**（计划写「$5 / $20 / $30 of included monthly credits」）。
- 内部：按 **input / output（及 cache）tokens** 计量，再按所选模型价折算进 credits。
- 2025-05 起从「固定 message 计数」迁到 token→credit（官方博文）。

来源：https://v0.app/docs/pricing · https://vercel.com/blog/updated-v0-pricing · https://v0.app/pricing

### 4.2 订阅档

| Plan | 价 | 月额度 | 备注 |
|------|----|--------|------|
| Free | $0 | **$5** credits | Pricing 页另写 **7 message/day**；Design Mode、Deploy、GitHub sync |
| Premium | $20 | $20 | Docs：**对新用户 sunset，不再开放** |
| Team | **$30 / user / 月** | **$30 / user** | + **$2 daily login credits / user**；可买加量；共享池 |
| Business | **$100 / user / 月** | **$30 / user**（同 Team 额度） | 默认 training opt-out；其余协作能力类似 Team |
| Enterprise | Custom | Custom | SSO、RBAC、SLA、priority |

模型价在 pricing 页按 Mini / Pro / Max / Max Fast 列出 $/1M tokens（input/output/cache）。

来源：https://v0.app/docs/pricing · https://v0.app/pricing

### 4.3 用尽、购买、共享池

- Credits 用尽 → **generation pauses**（硬停生成）。
- Premium / Team / Business 可随时买更多 credits。
- 未用月额度可滚到下周期，**65 天后过期**（docs）。
- Team/Business/Enterprise：**Shared Credit Pool** —— 个人月额度用完后才用共享池；共享池购买额度约 **1 年**过期。

来源：https://v0.app/docs/pricing · https://vercel.com/blog/updated-v0-pricing

### 4.4 可见性

- Usage：日/周/月汇总 + 事件日志（date、user、event type、model、cost）。
- Billing：计划、余额、过期日、支付方式。

来源：https://v0.app/docs/pricing

### 4.5 对 Open-OX 的含义

v0 把 credit **锚定美元**，并公开模型 token 价 —— 对「开发者向」产品透明，但对非技术用户偏硬。Open-OX 若偏创作者/建站，更宜 **整数 credits**（Lovable 风格），内部再映射成本。

---

## 5. Replit Agent

### 5.1 单位与 effort-based 定价

- 订阅带 **monthly credits**（美元面额），覆盖 Agent **以及** published apps、storage、database 等云用量。
- Agent：**effort-based** —— 按请求实际工作量；简单改动可 **<$0.25**，复杂任务单次 checkpoint 可更高。
- 历史：曾固定 **$0.25 / checkpoint**；2025-06 起改为 effort-based（官方博文）。
- **所有 Agent 交互都计费**，含 Plan mode（只规划不改代码也收费）。

来源：https://docs.replit.com/billing/ai-billing · https://replit.com/blog/effort-based-pricing · https://docs.replit.com/help/pricing-and-plans

### 5.2 订阅档（pricing 页）

| Plan | 价（公开页） | Credits | Agent 相关 |
|------|--------------|---------|------------|
| Starter | Free | 每日 Agent credits；有限 monthly cloud credits | 基础 Agent；1 published project |
| Core | **$25/月**（年付展示约 **$20**） | **$25** monthly credits | Full Agent、Plan/Build、最多 5 collaborators |
| Pro | **$100/月**（年付约 **$95**） | **$100** monthly credits | Turbo、最多 15 builders、**pooled credits**、1 个月 rollover |
| Enterprise | Custom | Custom | SSO、隐私、单租户等 |

能力矩阵另见 docs（Lite/Full build、Design Canvas、Visual Editor、modes 等按档解锁）。

来源：https://replit.com/pricing · https://docs.replit.com/billing/ai-billing

### 5.3 模式与控费

- Agent 模式：Lite / Economy / Power；Turbo（Pro）—— 用模式换成本/能力。
- Plan vs Build：Plan 可先定范围再动手，但 **Plan 本身也耗 credits**。
- 控费：usage alerts、**hard budget limits**、credit packs（大包有折扣，如 $300 credits 售 $290 等，见 help FAQ 表）。
- 可见性：checkpoint 上 hover usage icon；Usage dashboard（可延迟约 30 分钟）。

来源：https://docs.replit.com/billing/ai-billing · https://docs.replit.com/help/pricing-and-plans · https://docs.replit.com/help/agent-and-ai

### 5.4 对 Open-OX 的含义

Replit 把 **AI + 托管运行** 打进同一 credit 池，并强调 **budget 硬帽**（防 agent 循环烧钱）。Open-OX 若日后有托管/预览流量，可预留「同一余额、分桶展示」；v0.1 可先只计 AI build。

---

## 6. 横切模式（行业抽象）

### 6.1 三种「用户可见单位」

| 模式 | 代表 | 优点 | 风险 |
|------|------|------|------|
| **抽象 Credits（次数感）** | Lovable | 好懂；可加权；可统一 build+cloud | 需教育「为何这条不是 1」 |
| **美元 Credits** | v0、Replit | 与成本对齐；加量包直观 | 非技术用户「花了几刀」焦虑 |
| **裸 Tokens** | Bolt | 诚实反映上下文成本 | 难预测；项目变大后体感变贵 |

### 6.2 扣费粒度光谱

```text
固定/消息 ──► 混合（Plan固定 + Build加权） ──► 全量 effort/token
  (旧 v0)         (Lovable)                    (Bolt / v0新 / Replit)
```

共识：**轻量动作便宜、重生成贵**；纯本地/无 LLM 写回尽量免费或日配额（Lovable inline text）。

### 6.3 订阅商品形态

1. **月额度桶**（主商品）+ 功能门（自定义域、去 branding、SSO…）
2. **加量包 / reload / auto top-up**（防中断）
3. **免费档 = 日帽 + 月帽**（控羊毛与成本）
4. 团队：
   - **共享池 + 成员限额**（Lovable）
   - **Seat 分桶不共享**（Bolt Teams）
   - **个人额度 + 共享加量池**（v0）

### 6.4 用尽策略

| 策略 | 谁用 | 备注 |
|------|------|------|
| 硬停生成 | Lovable、v0、Bolt（额度用尽） | 最常见；配合升级/top-up CTA |
| Auto top-up + spend limit | Lovable | 托管场景怕 app pause |
| Budget hard cap + packs | Replit | Agent 长跑必备 |
| Pay-as-you-go 超额 | Replit 产品叙事 | 需强预算 UX，否则账单惊吓 |

### 6.5 UX 必备件

- 全局 **余额条**（workspace / 账户）
- **每 turn / checkpoint 事后精确 cost**
- Settings：**按项目 / 人 / 类型** 的用量明细
- 低余额 nudge；用尽 blocking dialog
- （可选）昂贵动作前的 **区间预估**（行业做得少；多为事后精确）

---

## 7. 对 Open-OX 的设计建议

> 非实现 PRD。贴合当前产品动作：`generate`、`modify`、Design Mode 写回、未来 publish/remix。

### 7.1 推荐模型（默认方向）

**用户可见：整数「积分 / credits」**；内部按 LLM 成本（token × 模型价 × 毛利系数）折算，四舍五入到 0.1 或 1 分精度对外展示。

理由：

- 与 Lovable 同赛道心智最接近；比 Bolt 的裸 token 更友好。
- 比 v0/Replit 的「$ 余额」更少账单焦虑，同时仍可加权。
- Open-OX 已有 workspace 概念 → **余额挂 workspace**，与 Lovable 一致。

### 7.2 动作 × 计费矩阵（建议）

| 动作 | 建议计费 | 说明 |
|------|----------|------|
| **Generate（整站/整项目生成）** | 重：按实际 LLM 成本折算，通常数～十余 credits | 对应 Lovable Build 大任务 / Replit 复杂 checkpoint |
| **Modify turn（改代码的 agent run）** | 中：按实际成本加权 | 小改可 <1 credit；大改 >1 |
| **Intent / blueprint / Plan 类确认对话** | 轻：固定小价（如 0.5～1）或按成本封顶 | 对齐 Lovable Plan=1；避免「只聊不改也天价」 |
| **Design Mode 纯本地写回**（无 LLM） | **免费** | 对齐「无模型不扣费」；这是差异化 |
| **Design Mode + LLM 描述改** | 同 Modify | 有模型就计费 |
| **Visual / 参考图分析** | 按实际视觉模型成本 | 可并入下一次 generate 账单或单独一行 |
| **Publish / 静态预览托管** | v0.1 **不计 AI 积分**；日后若有流量成本再开「Run」桶 | 先别把托管打进 AI 池，降低心智复杂度 |
| **Remix 拷贝项目** | **免费**（磁盘拷贝） | 后续 modify 才扣费 |
| **失败且几乎无产出的 run** | 按已消耗成本扣，或设「失败退还策略」产品规则 | 需明确，避免「修 bug 烧光积分」口碑 |

### 7.3 订阅档位骨架（建议起步）

| 档 | 价（示意） | 月积分 | 要点 |
|----|------------|--------|------|
| **Free** | $0 | 日帽（如 5）+ 月帽（如 30） | 能完成 1 次小 generate + 少量 modify；硬停 |
| **Pro** | 约 **$20–25/月** 起 | 可买额度档（如 100 / 200 / 400…） | 自定义域、去 branding、top-up |
| **Team / Business** | 更高单价或同额度更高价 | **共享池** + per-member 限额 | SSO/角色等可后置 |
| **Enterprise** | Custom | Volume | 合同、发票、审计 |

加量：**一次性积分包**（付费档）；可选 **auto top-up + 月 spend limit**（有托管后再强调）。

Rollover：付费月额度建议 **滚 1 个账期**（Bolt/Lovable/Replit Pro 共识）；Free 不滚。

### 7.4 内部计价公式（实现向）

```text
credits = ceil_or_round( (Σ model_cost_usd) / credit_usd_rate * margin )
```

- `credit_usd_rate`：例如 Pro 锚定 ~$0.25/credit（接近 Lovable Pro 折算叙事），对外不必写美元。
- 不同模型（快/强）通过真实 `model_cost_usd` 自然拉开，不必再发明第二套「模式倍率」——若要做 Economy/Power，用模型选择即可（Replit/v0）。

### 7.5 Studio UX

1. Workspace 顶栏或 Studio 侧栏：**剩余积分**。
2. 发起 Generate / 重 Modify 前：显示 **预估区间**（基于历史同类 run 的 p50–p90）；无法估准时写「完成后按实际结算」。
3. Turn 结束后：在对话/详情里写 **实际消耗**（可挂到现有 modify history / turn details）。
4. 用尽：blocking CTA → 升级或买包；Free 引导日重置时间。
5. Settings：按项目、按日的用量；admins 看成员（Team 档）。

### 7.6 刻意不抄

| 不抄 | 原因 |
|------|------|
| Bolt 裸 token 对外 | 项目变大后体感「越用越贵」且难解释 |
| v0 公开 $/1M token 表作主 UI | 对非开发者过载；可放进高级「成本明细」 |
| 一上来就把托管流量打进同一积分池 | Open-OX 托管模型未定；先 AI-only 更清晰 |
| 固定「每条消息 $0.25」 | 行业已证明会被复杂 agent 打穿；Lovable/Replit 都已加权 |
| Seat 税为主商品（Bolt Teams） | 与「workspace 共享创作」不符；优先共享池 |

### 7.7 建议落地顺序

1. **计量**：每个 LLM run 记 `usage` + `cost_usd`。现有 [`ai/shared/llm/gateway.ts`](../../ai/shared/llm/gateway.ts) 已解析 `prompt_tokens` / `completion_tokens`，可在此之上乘模型单价得到 `cost_usd`。
2. **账本**：workspace `credit_balance` + ledger（grant / spend / topup / expire）。
3. **扣费点**：`generate` 完成、`modify` turn 完成；本地 design writeback 跳过。
4. **门禁**：余额 < 预估下限则拒绝开跑（或仅警告）。
5. **定价页 + Free 日/月帽**。
6. 再做 top-up、Team 共享池、用量面板。

### 7.8 与现有产品面的映射（核对）

| Open-OX 现状 | 计费建议落点 |
|--------------|--------------|
| Generate pipeline（含 intent / blueprint 确认） | 确认轮轻价或封顶；`commit_generate` 后的 worker 重价 |
| Modify agent turns | Turn 结束按实际 LLM 成本入账；可挂现有 turn details / history UI |
| Design Mode 源码写回 | 无 LLM → 0；带描述的 LLM 路径 → 同 modify |
| Publish / remix（见 workspace-community PRD） | 拷贝与上架不扣 AI 积分；后续编辑才扣 |

---

## 8. 来源索引（第一方）

| 产品 | URL |
|------|-----|
| Lovable credits | https://docs.lovable.dev/introduction/credits-and-usage |
| Lovable plans | https://docs.lovable.dev/introduction/subscription-plans |
| Lovable pricing | https://lovable.dev/pricing |
| Lovable Plan mode | https://docs.lovable.dev/features/plan-mode |
| Lovable Build mode | https://docs.lovable.dev/features/agent-mode.md |
| Lovable glossary | https://docs.lovable.dev/glossary |
| Bolt pricing | https://bolt.new/pricing |
| Bolt tokens | https://support.bolt.new/account-and-subscription/tokens |
| v0 docs pricing | https://v0.app/docs/pricing |
| v0 pricing page | https://v0.app/pricing |
| v0 pricing blog | https://vercel.com/blog/updated-v0-pricing |
| Replit AI billing | https://docs.replit.com/billing/ai-billing |
| Replit pricing | https://replit.com/pricing |
| Replit pricing FAQ | https://docs.replit.com/help/pricing-and-plans |
| Replit effort blog | https://replit.com/blog/effort-based-pricing |
| Replit Agent FAQ | https://docs.replit.com/help/agent-and-ai |

**缺口**：Lovable 营销 pricing 页为强客户端渲染，抓取正文不全，档位数字以 **docs subscription-plans** 为准；Replit Core/Pro 的 credits 美元数以 **pricing 页** 为准，help 文中部分占位符未展开。

---

## 9. 一句话给产品

做 **workspace 共享的加权积分**：Plan/确认便宜且可预期，Generate/Modify 按真实成本结算，无 LLM 的 Design 写回免费；订阅卖月额度桶，付费可加量与有限 rollover；用尽硬停并给清晰充值路径——这是 2026 年 AI builder 的主流解，也最贴合 Open-OX。
