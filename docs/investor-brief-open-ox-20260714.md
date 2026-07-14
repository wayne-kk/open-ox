# Open-OX 投资人汇报

**版本**：2026-07-14  
**定位一句话**：从一句自然语言 Brief，交付可运行、可验证、可迭代、可部署的真实 Next.js 工程——不是截图，不是沙箱幻觉。  
**Slogan**：Think it. Build it. Run it.

---

## 0. Elevator Pitch（30 秒）

多数 AI 建站工具停在「看起来像网站」。Open-OX 走的是**软件工程产线**：结构化意图 → 设计系统 → 多 Agent 并行实现 → 构建门禁与自愈 → 透明 Studio → 导出工程 / BYO Vercel 上线。

我们服务的是**个人与小团队**：不想再雇一轮外包「把 AI 草稿修成能上线的东西」的人。交付物归用户——源码可带走，生产站跑在用户自己的 Vercel 账单上。

**商业化已接通**：Credits 计量（LLM → USD → credits）+ Stripe Pro 订阅 / 加油包；Free 欢迎礼拉新，用完硬停导向付费。

---

## 1. 问题与市场机会

### 1.1 痛点

| 现状 | 用户真实代价 |
|------|----------------|
| ChatGPT / Claude 出代码片段 | 拼不成可构建站点，仍需工程师 |
| Webflow / Framer | 门槛高，设计与组件能力要求强 |
| Lovable / Bolt / v0 等 AI Builder | 体验强，但常有平台锁、黑盒、交付「不够工程」的摩擦 |
| 外包建站 | 贵、慢、改一次排期一次 |

**核心缺口**：从「想法」到「可上线 Next.js 工程」之间，缺少一条**可重复、可审计、可带走**的生产流水线。

### 1.2 目标用户（ICP）

1. **独立开发者 / 创作者** — 要落地页、作品集、活动站，要真源码  
2. **小团队 / 创业公司** — 快速验证品牌站与营销页，控制 AI 成本  
3. **设计 / 增长同学** — 用自然语言 + Design Mode 精修，少写代码  
4. **（中期）代理商 / 站群** — 模板 + 品牌资产复用，批量产出

### 1.3 竞争格局（简表）

| | 典型 AI Builder | Open-OX |
|--|-----------------|---------|
| 交付物 | 平台内应用 / 托管站 | **真实 Next.js 工程** |
| 过程 | 多为黑盒 | **流式管线 + 可审计 Agent 轨迹** |
| 精修 | 主要靠再聊一轮 | **Modify Agent + Design Mode 源码写回** |
| 上线 | 平台托管为主 | **导出 + BYO Vercel（用户账单）** |
| 社区 | 有 | Publish Preview / Allow Remix（未来可变现） |

对标公开定价（调研日 2026-07）：Lovable / Bolt / Replit Agent 等 Pro 档多落在 **~$25/月** 起；行业已收敛到 **Credits + 订阅额度桶 + Top-up**。Open-OX 定价与此同构，降低教育成本。

---

## 2. 产品功能（What we built）

### 2.1 核心闭环

```text
Brief → 多节点生成管线 → 构建/自愈 → 预览
      → Modify / Design Mode 迭代
      → 导出 ZIP 或 BYO Vercel Deploy
      → （可选）Community Publish / Remix
```

### 2.2 能力地图

| 模块 | 用户价值 | 成熟度（相对） |
|------|----------|----------------|
| **Prompt → Project 管线** | 8 节点工程化生成，失败可定位、重试成本低于整站重骰 | 已落地 |
| **设计系统 + 30+ Style Skills** | 一致性靠结构；Swiss / Neo-Brutalism / Glass… 可切换气质 | 已落地 |
| **参考图双模式** | Replicate（布局保真）/ Extract（借色与气质） | 已落地，持续加强 |
| **Studio 全链路 Trace** | 拓扑、日志、Agent 步骤流式可见，建立信任 | 已落地 |
| **Modify Agent** | 自然语言改站：读/搜/编/构建；结构化 diff 与历史 turn | 已落地 |
| **Design Mode** | 预览点选 → 调色/字号/间距 → **服务端 JSX AST Direct Apply** | 已落地（Lite） |
| **可靠预览** | Storage 静态分享 URL / 本地 `next dev`（HMR+插桩）/ E2B 沙箱 | 已落地 |
| **Workspace · Community · Remix** | 私有默认；主动 Publish；Allow Remix 拷贝许可与血缘 | 产品模型已定，实现按路线推进 |
| **工程导出** | 带走真实代码库 | 已落地 |
| **BYO Vercel Deploy** | OAuth 连用户账号；静态 `out/` 上传；Disconnect 不删远端 | 已落地（ADR-0003） |
| **Credits + Stripe** | 欢迎礼 12 → Pro / Top-up；Design Mode / Remix / Publish 不耗分 | 已落地 |

### 2.3 生成管线（投资人可背）

1. Intent Agent — 随口一说 → 可执行 Brief  
2. 设计意图 — 文案 / 参考图 → 视觉方向  
3. 项目规划 — 模块受规格约束  
4. 设计系统 — token / 字阶 / 间距全站共享  
5. Architect 脚手架 — 一次架构 pass  
6. Page Implement Agents — 工具循环写真实 TSX  
7. 依赖安装  
8. 构建 + 自动修复 — 编译门禁，定向 repair  

### 2.4 设计押注（产品哲学）

1. **可验证优于炫技** — 构建不过、预览不稳，再漂亮也是负债  
2. **透明优于黑盒** — Studio traces 评价系统  
3. **修改一等公民** — 生成点火；Modify + Design Mode 巡航  
4. **交付物归你** — 源码可导出；生产站在用户 Vercel  
5. **约束换质量** — 先把高完成度单首页做透，再放开多页  

---

## 3. 技术架构（How it works）

### 3.1 总览

```text
Browser · Studio UI
   └─ Next.js API（SSE 编排）
        ├─ AI Flows
        │    ├─ generate_project
        │    └─ modify_project
        ├─ Supabase（Postgres · RLS · Storage）
        ├─ Billing（Credits 账本 · Stripe Webhook）
        └─ Preview / Deploy
             ├─ /site-previews · local next dev · E2B
             └─ BYO Vercel OAuth → 生产 URL
```

### 3.2 技术栈

| 层 | 选型 |
|----|------|
| 应用 | Next.js 16 · React 19 · TypeScript |
| UI | Tailwind CSS v4 · shadcn / Radix · Framer Motion · Three.js |
| 数据 | Supabase（Postgres + Storage + RLS） |
| 预览 | Storage 静态 · 本地 `next dev` · E2B |
| 部署 | Vercel Integration OAuth |
| 模型 | OpenAI-compatible API（可换供应商） |
| 可观测 | Langfuse · Studio SSE traces |
| 计费 | Stripe · Credits 账本 |

### 3.3 关键工程决策（壁垒相关）

| 决策 | 为什么重要 |
|------|------------|
| **原生 fetch + 长超时**，而非默认 OpenAI SDK | Section 级 LLM 可达数十秒；SDK 默认短 socket 会断流。同时便于切换任意兼容模型 |
| **多 Agent 固定节点 I/O** | 失败局部化；成本与质量可分节点优化 |
| **构建门禁 + 自动修复** | 「能编译」是产品契约，不是事后 QA |
| **Design Mode：源码坐标 + 服务端 AST Direct Apply** | 定位键是编译期 `file:line:col`（`data-ox-source`），写回真实磁盘源码并校验；搞不定则 handoff Modify（人确认），无静默第二套写盘引擎（ADR-0001） |
| **预览三后端** | 分享确定性（Storage）、精修 HMR（local）、隔离运行（E2B）按场景切换 |
| **BYO Deploy** | 不把生产托管做成锁客；信任与合规更清晰，毛利结构也更轻（不背用户流量账单） |
| **Credits = token → USD → credits** | 与真实 LLM 成本对齐；门禁 + 成功才扣 Generate，避免「跑失败也扣光」的信任崩塌 |

### 3.4 规模与质量信号（架构文档基线）

| 指标 | 数量级 |
|------|--------|
| 端到端生成 | ~90 秒量级（视模型与复杂度） |
| 并行 Agent | 最多 7+（section 并行） |
| 构建自动修复 | 最多约 5 轮 |
| Modify 工具循环 | 上限约 100 次迭代（防护） |

---

## 4. 壁垒与护城河（Why us）

> 投资人最关心：可复制性 vs 可持续优势。以下按「今天已有」与「可加深」分开说。

### 4.1 今天已形成的差异化

| 壁垒类型 | 内容 | 可防守性 |
|----------|------|----------|
| **产品形态** | 「工程产线」而非「聊天出站」：门禁、自愈、可导出、BYO 上线 | 高 — 体验与心智难一晚上抄齐 |
| **Design Mode 写回路径** | 源码坐标 + AST Direct Apply（对标 Lovable 类视觉编辑的工程化实现） | 中高 — 依赖预览插桩与 AST 约束，有研发深度 |
| **透明 Studio** | 全链路 trace 是信任产品，也是调参与 B 端销售的弹药 | 中 — 可被模仿，但与管线深度绑定 |
| **交付归属叙事** | 源码归用户 + 生产在用户 Vercel = 反平台锁 | 高 — 战略选择，竞品难同时「锁托管又说开源友好」 |
| **计费与成本闭环** | 真实成本折算 + 成功才扣 + 本地写回免费 | 中 — 运营与信任复合优势 |

### 4.2 可加深的护城河（12–24 个月）

1. **数据与工作流飞轮**  
   Community / Remix 形成模板与气质样本 → 提高首次成功率 → 降低获客 CAC。  
   *未来：Remix 许可可变现（产品语义已预留，不绑死在 Publish）。*

2. **品牌与设计资产库**  
   Style Skills、成功蓝图、团队 token → 二次建站边际成本下降（对代理商极有吸引力）。

3. **质量门禁体系**  
   从「能 build」扩展到验收清单、关键路径、可访问性 — 谁先把「上品控」做成默认，谁就吃 B 端与代理商。

4. **集成与场景楔子**  
   飞书等企业入口、参考 URL「拆了重装」、气质三选一等拉新钩子（见产品想法池）— 把获客做成产品能力。

5. **模型路由与成本曲线**  
   节点级模型选型、缓存、失败策略 — 同样体验下单位成本更低，就是毛利护城河。

### 4.3 诚实边界（投资人会问）

| 风险 | 应对 |
|------|------|
| 大厂 / 头部 AI Builder 跟进 | 押「真工程 + 可带走 + 透明」细分；不拼纯营销页截图 |
| 模型能力同质化 | 价值在编排、门禁、写回、交付闭环，不在单次 prompt |
| 当前以单首页为主 | 路线图已规划多页 / 增量路由；先把单页上品控做透是刻意约束 |
| 尚无大规模公开 GMV 叙事 | 商业化管道已通；下一阶段用转化漏斗与单用户贡献验证 |

---

## 5. 盈利模式（How we make money）

### 5.1 当前主路径（已落地）

**计量单位**：Credits（内部：LLM tokens → USD → credits，可配 margin）

| 收入类型 | 机制 | 说明 |
|----------|------|------|
| **Pro 订阅** | Stripe `subscription` | 档位示例：Pro 100 / 200 / 400 credits（约 $25 / $50 / $100） |
| **Top-up** | Stripe 一次性 | 50 / 100 / 200 credits 加油包 |
| **Free** | 欢迎礼 **12 credits**（一次性） | 用完硬停 → `/pricing`；无日发「白嫖无限」 |

**扣费边界（信任设计）**：

- 扣费：Generate（成功且可预览）、Modify turn  
- 不扣费：Design Mode 本地 Direct Apply、Remix 拷贝、Publish Preview、Deploy  

**门禁示例**：Generate ≥ 8；Modify ≥ 0.5。超额花费夹到余额（不记债）。

### 5.2 单位经济逻辑（讲故事用）

```text
毛利 ≈ 用户支付 Credits 金额 − 实际 LLM 成本 − 基础设施（预览/存储）
```

- **按真实成本折算** → 模型涨价可调汇率 / margin，不绑死固定「每条消息价」  
- **BYO Vercel** → 生产流量账单在用户侧，平台不背托管毛利黑洞  
- **Design Mode 免费写回** → 提升精修满意度，把付费集中在「烧 token」的生成/大改  

### 5.3 中期扩展收入（产品已留语义）

| 方向 | 逻辑 |
|------|------|
| **Remix 许可收费** | Allow Remix = 拷贝许可门槛；未来可对热门模板/作者分成 |
| **团队 / Business** | 共享额度池、RBAC、SSO、品牌资产库（对标行业 Business 档） |
| **代理商 / API** | 批量建站、白标、自动化入口 |
| **增值 Skill / 模板市场** | 优质风格包与垂直模板分成 |

### 5.4 与竞品定价同构的好处

公开市场已教育用户接受 **~$25/月起的 Credits 订阅**。Open-OX 无需重新发明货币单位，降低获客解释成本；差异化放在**交付质量与归属感**，而非「更便宜的玩具」。

---

## 6. 增长与 GTM（简版）

| 杠杆 | 动作 |
|------|------|
| **产品即获客** | Community 可截图传播；Remix 降低「从零 prompt」摩擦 |
| **拉新钩子（规划）** | 竞品/偶像站 URL → 品牌重装；Brief 三气质分叉再深造 |
| **信任内容** | 透明管线 demo、导出真实工程、开源友好叙事 |
| **渠道** | 独立开发者社区、飞书等企业场景、设计/增长 KOL |
| **转化** | 欢迎礼 12 credits 体验完整 Generate → 硬停导向 Pro / Top-up |

---

## 7. 路线图（投资人时间轴）

| 阶段 | 主题 | 价值 |
|------|------|------|
| **A（近）** | 交付闭环强化 | 部署引导、预览生命周期、导出一致性 — 「能上线」无阻塞 |
| **B** | 结构与规模 | 单页 → 多页 / 增量路由 — 吃公司站场景 |
| **C** | 意图与复用 | Guided brief、生成前蓝图确认、模板 — 抬首次成功率 |
| **D** | 修改与信任 | Diff、验收、回滚 — 留存与口碑 |
| **横切** | 成本与生态 | 团队池、Skill/模板市场、API |

---

## 8. 融资叙事建议（可按轮次裁剪）

### 8.1 我们是谁

**AI-native 网站生产引擎**：把「建站」从聊天玩具做成可重复的软件产线。

### 8.2 为什么是现在

- 模型已够写复杂 TSX，但**编排 + 门禁 + 写回 + 交付**仍稀缺  
- 用户已被 Lovable 等教育愿意为 Credits 付费  
- 「反锁」与「真工程」在开发者心智中溢价上升  

### 8.3 资金用途（模板）

1. **核心工程**：多页、质量门禁、Design Mode 加深、成本优化  
2. **增长**：Community/Remix、拉新钩子、内容与演示资产  
3. **商业化**：团队档、Remix 变现、用量分析与风控  
4. **人才**：全栈 + Agent 编排 + 设计系统 / 增长  

### 8.4 成功指标（建议对外承诺的方向）

- 激活 → 首次可预览成功率  
- Free → 付费转化率、Credits 消耗与毛利率  
- 导出 / Deploy 完成率（「真交付」北极星）  
- Remix / Community 参与率（飞轮）  

---

## 9. 一页纸总结

| 维度 | 要点 |
|------|------|
| **功能** | Brief→工程管线；Modify + Design Mode；可靠预览；导出；BYO Deploy；Community/Remix；Credits |
| **架构** | Next.js + Supabase + 多 Agent Flows + 三预览后端 + Stripe；SSE 透明 Studio |
| **壁垒** | 工程化产线、源码级 Design Mode、反平台锁交付、成本对齐计费；加深靠飞轮与质量门禁 |
| **盈利** | Pro 订阅 + Top-up（主）；Remix/团队/模板市场（延展）；轻托管成本结构 |

**一句话收束**：  
Open-OX = 意图 × 设计系统 × 多 Agent 实现 × 构建自愈 × 透明 Studio × 社区 Remix × BYO 部署。  
不是又一个「AI 写网站」玩具——是把网站生产做成**可重复、可审计、可交付**的流水线。

---

## 附录：关键文档索引

| 文档 | 用途 |
|------|------|
| `README.zh-CN.md` | 产品对外叙事 |
| `CONTEXT.md` | 术语表 |
| `docs/architecture.md` | 技术架构详解 |
| `docs/adr/` | 关键决策（Design Mode / Community / BYO Deploy） |
| `docs/product/credits-v0.*.md` | 计费规格 |
| `docs/research/ai-builder-credits-pricing-20260711.md` | 竞品定价调研 |
| `docs/product-iteration-outline.md` | 产品路线图 |

---

*本稿基于仓库产品文档与实现现状整理，供路演 / 备忘录使用。涉及未公开财务数据与具体融资条款处留空，请按实际数字替换。*
