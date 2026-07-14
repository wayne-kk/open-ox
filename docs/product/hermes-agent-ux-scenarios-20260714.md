# Open-OX × Hermes Agent：架构启发与体验场景

**版本**：v0.1  
**日期**：2026-07-14  
**状态**：想法池（未立项；供排期与 PRD 拆解）  
**目标**：从 [Hermes Agent](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)（NousResearch）的架构设计中抽取可映射到 Open-OX 的模式，并展开为**以提高用户体验为重心**的场景草案  
**关联**：
- 体验向想法池：[`ux-expansion-ideas-20260710.md`](./ux-expansion-ideas-20260710.md)
- 拉新/传播向想法池：[`attraction-ideas-20260713.md`](./attraction-ideas-20260713.md)
- Modify 短程记忆：[`modify-working-memory-v0.1.md`](./modify-working-memory-v0.1.md)
- 术语：根目录 [`CONTEXT.md`](../../CONTEXT.md)
- 迭代大纲：[`docs/product-iteration-outline.md`](../product-iteration-outline.md)

**外部参考**（非实现规格）：
- [Architecture | Hermes Agent](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)
- [Kanban (Multi-Agent Board)](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)

---

## 1. 文档说明

| 项 | 说明 |
|----|------|
| 来源 | 产品 brainstorm（2026-07-14）：调研 Hermes Agent 架构后，对照 Open-OX 生成管线 / Studio / Design Mode / Modify / Community / 飞书等能力，提出体验向场景 |
| 读者 | 产品、设计、工程 |
| 用法 | 与体验池、拉新池并列；挑 1–2 条深聊后写 PRD / 拆 `.scratch/<slug>/`；勿与已有想法重复立项 |
| 非目标 | 不替代路线图；不承诺排期；不含实现规格；不照搬 Hermes 代码或部署形态 |

### 1.1 与既有想法池的边界

| 文档 | 焦点 |
|------|------|
| [`ux-expansion-ideas-20260710.md`](./ux-expansion-ideas-20260710.md) | 抬首次成功、改站信任、交付闭环（蓝图、Diff、意图条、体检、批注等） |
| [`attraction-ideas-20260713.md`](./attraction-ideas-20260713.md) | 拉新钩子、传播叙事、场景楔子 |
| **本文** | **Agent 运行时 / 记忆 / 协作 / 值班** 类架构启发 → 用户体感场景；可与上两池组合，但立项时写清「架构杠杆」 |

### 1.2 产品锚点

- **定位**：从一句自然语言到可运行、可验证、可迭代的真实 Next.js 站点。
- **已有差异化**：生产级工程输出、透明流水线、Modify-first、Design Mode 源码写回、Community Publish Preview + Remix、飞书等集成。
- **本文原则**：把 Agent 从「聊天里的一次性劳工」升级成「有记忆、有看板、有值班表的站点同事」；用户成功与可控优先于 Agent 炫技。

### 1.3 一句话翻译

Hermes 对 Open-OX 最值得抄的不是「再多一个 Agent」，而是几条体验层设计：

1. **会越用越懂你**（学习闭环 + 用户建模）
2. **任务可并行且可打断**（Kanban / interrupt-and-redirect）
3. **工作在你不在时也能推进**（cron / gateway）
4. **执行过程可感知、中间脏态不污染对话**（observable + RPC 式编排）

---

## 2. Hermes 架构要点（对照用摘要）

便于后续分析时回看「从哪抄的」；细节以官方文档为准。

### 2.1 系统分层（三层）

```text
Entry points（CLI / Gateway / Cron / ACP / API）
        ↓
AIAgent 核心循环（prompt 组装、provider、tool dispatch、压缩、持久化）
        ↓
Tool backends + Session storage（终端多后端、浏览器、MCP；SQLite + FTS5）
```

| 子系统 | Hermes 在做什么 | 对 Open-OX 的联想 |
|--------|-----------------|-------------------|
| **Agent Loop** | 统一编排：选模型、拼 prompt、跑工具、重试、压缩、落盘 | 生成管线 / Modify 已有多步；可强化「可中断、可观察、可续写」 |
| **Prompt 分层** | stable → context → volatile；中途不乱改 system（保缓存） | 口味记忆 / Skill 应进稳定层，勿塞进每轮脏历史 |
| **Tool Registry** | 工具自注册；按 profile / 平台暴露不同 toolset | Studio vs 飞书 Bot vs 定时任务：同一核心、不同工具面 |
| **Session + FTS5** | 会话当基础设施；压缩保留 lineage；可跨会话检索 | 超越「最近 N 轮 transcript」；与 Working Memory 分层 |
| **Memory + Skills** | MEMORY/USER、定期 nudge、成功路径抽 Skill、用中 refine | 跨会话偏好（今日文档标为未解决）；个人/社区模板飞轮 |
| **Gateway** | 多消息平台适配；统一 session 路由；可中断重定向 | 飞书 ↔ Studio 连续改站 |
| **Cron** | 自然语言定时 Agent 任务，结果投递到任意通道 | Community / 发布前自动体检 |
| **Kanban** | SQLite 任务板 + dispatcher；Worker 独立进程；依赖门控 | 「大改一整站」从单条超长 Modify → 可并行看板 |
| **Delegate / RPC 编排** | 子 Agent 并行；脚本调工具走 RPC，中间结果不进主上下文 | 竞品分析 + 气质分叉等脏活藏在流水线里 |

### 2.2 Hermes 设计原则（可当验收口径）

| 原则 | 实践含义 | Open-OX 体验翻译 |
|------|----------|------------------|
| Observable execution | 每个 tool call 对用户可见 | 改站进度、看板状态、预览截图，而非静默转圈 |
| Interruptible | 中途可取消 / 用新指令重定向 | 「先停，改成深蓝」立刻生效 |
| Platform-agnostic core | 一套 Agent，入口不同 | Studio / 飞书 / 定时共用语义，不复制三套逻辑 |
| Profile isolation | 多身份隔离配置与记忆 | 项目级口味 vs 用户级偏好 vs 社区 Skill 边界清晰 |

---

## 3. 体验场景（6 则）

### 3.1 「越改越懂我的站」——学习闭环 + 用户建模

**Hermes 启发**：成功任务抽成 Skill；跨会话 USER 模型；定期 nudge 只留高价值记忆。

**场景**：用户第三次把 Hero 改成「更大字、更少文案、偏 Apple」。系统不问问卷，而是在第 4 次 Modify 时直接说：

> 按你之前的偏好，这次会用更大字号 + 更短文案。要换风格可以说一声。

并把偏好落成项目级「设计口味卡」（不是塞满 transcript）。下次新项目从 Community Remix 进来时，可问一句：「沿用你在《XX》里的克制风？」

**体验收益**：从「每次从零教 AI」变成「它记得我是谁」。

**与现有能力衔接**：
- 已有：[`modify-working-memory-v0.1.md`](./modify-working-memory-v0.1.md) 解决短程失忆（失败模式 A）与上下文噪音（D）
- 本文补：跨会话偏好（文档中的失败模式 B）、长期设计决策（C）、用户可感知的记忆面（E 的产品面）
- 可组合：体验池「意图条」、拉新池「三版气质分叉」——口味卡可作为默认偏置

**非目标（草案）**：不做通用「第二大脑」聊天机器人；记忆默认项目作用域，用户级偏好需显式同意。

---

### 3.2 「改一整站，像看看板」——Kanban 任务图 + 并行 Worker

**Hermes 启发**：一句话拆成 durable task graph；多 Worker 并行；依赖门控（全做完再 verify）。

**场景**：用户说「上线前把整站准备好：Pricing 对齐、手机端 Hero、SEO、无障碍」。Studio 不塞进一条超长 Modify，而是弹出轻量看板：

| 待办 | 进行中 | 待确认 | 完成 |
|------|--------|--------|------|
| SEO meta | Pricing 文案 | 移动端 Hero 预览 | — |

每条任务独立跑（甚至不同模型：文案用便宜模型，布局用强模型）。用户可以点某一条「先做这个」「先别动 Pricing」。全部绿了再出「一键合入预览」。

**体验收益**：大改不再像黑盒长等待；用户掌控优先级；失败可单任务重试，不像整轮作废。

**与现有能力衔接**：
- 已有：Modify Agent、透明流水线叙事、Credits 计量
- 可组合：体验池「改完立刻对比」Diff、发布前体检
- 注意：看板是**用户可控的任务面**，不是再堆一个不可见的多 Agent 炫技层

**非目标（草案）**：v0.1 不做完整 OS 级多进程 Kanban；先做「可取消的任务切片 + 状态可见」即可验证体验。

---

### 3.3 「飞书里改站，回 Studio 接着改」——Gateway 统一会话

**Hermes 启发**：多入口、一套 session；跨平台对话连续；interrupt-and-redirect。

**场景**：老板在飞书甩一句「Hero 太吵，收一收」。Open-OX Bot 改完发一张 Preview 截图 + 「已写入源码」。用户晚上打开 Studio，聊天记录、Modify History、Design Mode 焦点都在，继续说「再淡一点」无缝续写。

反过来：Studio 里改到一半出门，手机飞书说「先停，改成深蓝」——中断当前 run，按新指令重定向。

**体验收益**：改站发生在沟通发生的地方；「人在飞书、工程在 Studio」不再割裂。

**与现有能力衔接**：
- 已有：飞书等集成叙事（见拉新池产品锚点）、Modify History Turn 语义单元、Working Memory
- 关键：跨入口必须共享同一 `ModifyHistoryTurn` / 项目会话键，避免双源真相

**非目标（草案）**：不把 Studio 完整搬到飞书；飞书侧以「指令 + 预览截图 + 深链回 Studio」为主。

---

### 3.4 「半夜体检，早上只看红灯」——Cron 式 Agent 任务

**Hermes 启发**：自然语言定时任务；交付到任意通道；可附带 skill。

**场景**：用户设一次：「每天早 9 点检查我发布的 Community 预览：死链、对比度、移动端溢出」。早上飞书/邮件只收到：

> 《Acme 落地页》2 个问题 · [一键修好] [忽略]

点「一键修好」打开 Studio，已带好 Modify 草稿；不是又一份 PDF 报告。

进阶：上线前 24h 自动跑「访客视角走查」——像真人点 CTA、填表、看加载——只汇报「会劝退用户」的 3 条。

**体验收益**：从「我记得要检查」变成「产品替我守夜」；与 Community / Publish Preview 天然咬合。

**与现有能力衔接**：
- 已有：Publish Preview、Community、体验池中的体检类想法
- 差异：定时 + 投递 + 「修好」直达 Modify，而不只是静态报告

**非目标（草案）**：不做通用运维平台；范围限定在「预览质量 / 访客劝退点」。

---

### 3.5 「复杂流程压成一次呼吸」——RPC 式工具编排 / 低上下文成本流水线

**Hermes 启发**：子 Agent 并行；脚本调工具走 RPC，中间结果不挤进主对话上下文。

**场景**：用户说「按这个竞品气质重做，但保留我的文案」。表面一次对话，背后：

1. 抓竞品结构（子任务 A）
2. 抽用户现有文案资产（子任务 B）
3. 出三套气质小样（子任务 C）

主对话只看到：「正在分析竞品 → 三套气质可选 → 你点 B」。中间截图、DOM、token 草稿都不污染聊天窗。

**体验收益**：对话保持「像和设计师说话」；贵且脏的中间态藏在流水线里——对齐「先确认再烧 token」。

**与现有能力衔接**：
- 已有 / 在途：蓝图预览 PRD、拉新池「竞品 URL → 拆了重装」「三版气质分叉（Token 实装小样）」
- 本文强调的是**编排与上下文卫生**，不是再发明一种气质 UI

**非目标（草案）**：不对用户暴露子 Agent 拓扑图（除非 Debug）；默认只暴露阶段进度与可决策物。

---

### 3.6 「这次改法，下次变成技能」——Skill 自抽取 + 可点用

**Hermes 启发**：复杂成功路径 → 可复用 Skill；用的时候再 refine；兼容 agentskills 类开放标准思路。

**场景**：用户花 8 轮调出「电商 PDP：信任条 + 尺码表 + 评价墙」。结束后弹：

> 要不要存成技能「电商信任型 PDP」？下次一句话就能套。

技能出现在 Studio 斜杠命令 / 生成前蓝图模板。Community 里优质 Remix 也可「一键变成我的技能」（作者 opt-in）。用多了，技能旁显示「最近 12 次成功率」。

**体验收益**：个人效率飞轮 + Community 内容飞轮；用户感到产品在「为我沉淀方法论」，而不只是一次性生成器。

**与现有能力衔接**：
- 已有：Remix、Allow Remix、Publish Preview、生成管线步骤化
- 可组合：3.1 口味卡可作为 Skill 的默认参数；3.2 看板可作为 Skill 的执行形态

**非目标（草案）**：不做开放 Skill 市场的完整电商；v0.1 先个人私有 Skill + 可选分享。

---

## 4. 优先级直觉（供后续分析，非承诺）

| 优先级直觉 | 场景 | ID | 为什么先做 |
|-----------|------|-----|-----------|
| 最高 | 看板并行改站 | 3.2 | 直接解决「大改又慢又慌」 |
| 最高 | 口味记忆 | 3.1 | 与 Working Memory 顺接，复购感强 |
| 高 | 气质/竞品流水线藏脏活 | 3.5 | 强化已有蓝图 + 气质分叉 |
| 中高 | 飞书 ↔ Studio 会话连续 | 3.3 | 差异化强，偏集成 |
| 中 | 夜间体检 | 3.4 | 绑 Community / 发布闭环 |
| 中 | Skill 沉淀 | 3.6 | 中长期护城河，依赖前几条数据 |

**建议分析顺序**：先定「最高」两项是否与体验池 P0（蓝图、意图条、Diff）冲突或可合并；再决定集成向（3.3）是否单独里程碑。

---

## 5. 场景 × 现有产品能力速查

| 场景 | Generate | Design Mode | Modify | Memory | Community / Remix | 飞书等入口 | Credits |
|------|----------|-------------|--------|--------|-------------------|------------|---------|
| 3.1 口味记忆 | 默认偏置 | 意图条可吃偏好 | 主战场 | **扩展层** | Remix 可询问沿用 | 可选同步偏好声明 | 不另计或极低 |
| 3.2 看板并行 | 少 | 可挂任务到选区 | **主战场** | 任务状态 | — | 可推送任务完成 | 按任务切片计量更友好 |
| 3.3 Gateway 会话 | — | 深链回焦点 | **主战场** | 共享 turn | 预览截图 | **主战场** | 同 Modify |
| 3.4 Cron 体检 | — | — | 修好入口 | 报告摘要 | **主战场** | 投递 | 定时跑需配额策略 |
| 3.5 藏脏活编排 | **主战场** | — | 可复用 | 不进聊天 | 竞品合法声明 | — | 「先确认再烧」更省 |
| 3.6 Skill | 模板入口 | — | 萃取入口 | Skill 库 | 分享 / Remix→Skill | 斜杠 | 套用可打折叙事 |

---

## 6. 后续动作（文档级，非排期）

1. 从 §4 挑 1–2 条，对照 [`ux-expansion-ideas-20260710.md`](./ux-expansion-ideas-20260710.md) 做去重 / 合并表。
2. 入选项写 PRD：用户旅程、成功标准、非目标、与 `ModifyHistoryTurn` / Credits 的边界。
3. 工程侧拆 `.scratch/<feature-slug>/` issue；涉及域术语时更新 `CONTEXT.md` / ADR（仅当决策锁定后）。

---

## 7. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-07-14 | v0.1 | 初稿：Hermes 架构摘要 + 6 个体验场景 + 优先级直觉 + 能力速查 |
