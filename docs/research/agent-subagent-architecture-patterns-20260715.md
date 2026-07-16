# 调研：Agent / Subagent 架构模式与 open-ox 整站编排整合（2026-07-15）

**状态**：完成（基于第一方公开材料：Cursor / Claude Code / VS Code Copilot / OpenAI Agents SDK 官方文档；open-ox 现状来自本仓库源码与 ADR，非竞品来源）  
**日期**：2026-07-15  
**问题**：主流 coding IDE 与 AI builder 如何定义 **Agent vs Subagent**？哪些场景适合引入 subagent？相对 open-ox 当前「手写多步管线 + 多角色 tool-loop」整站架构，是否存在命名混乱、重复入口、需要整合的地方？

**范围说明**：

1. **必查第一方**：Cursor Subagents、Claude Code Subagents / parallel agents、VS Code Copilot Subagents、OpenAI Agents SDK orchestration（handoffs vs agents-as-tools）。
2. **对照语境**：open-ox generate（chrome-first）与 modify（loopEngine / BoardRun）——见 §7；产品级 chrome 所有权另见 [chrome-shell 调研](./ai-builder-chrome-shell-pipelines-20260715.md)。
3. **不把** Medium / SEO「Top N multi-agent」合集当作架构证据；第三方博客仅作「存在讨论」线索。
4. **不设计**具体 Open-OX Subagent Runtime API；本笔记只提炼可执行的整合方向。

**来源分层（全文适用）**：

| 标签 | 含义 |
|------|------|
| **A. 官方文档 / 第一方 changelog** | cursor.com/docs、code.claude.com、code.visualstudio.com、developers.openai.com / openai.github.io |
| **B. 本仓库源码与 ADR** | `ai/flows/**`、`docs/adr/0005-*`、`docs/architecture.md` |
| **C. 推断** | 将 A 映射到 B 时的整合建议（非厂商承诺） |

---

## 1. 结论摘要（先读）

| 问题 | 一手材料能支持的答案 |
|------|---------------------|
| **A. Subagent 是什么？** | 主流定义高度一致：**父 agent 委托的、独立 context window 的 specialized worker**；中间产物留在子会话，父侧只收最终摘要。Cursor / Claude Code / VS Code 均如此表述。 |
| **B. 何时用 subagent，何时不用？** | 适合：上下文隔离（探索/日志/浏览器噪声）、并行 workstream、专精多步任务、独立 verification。不适合：单次短任务（用 skill / prompt / 确定性步骤）。OpenAI 另强调：**仅当 instruction / tools / policy 合同真正分叉时再拆 specialist**。 |
| **C. 编排有哪几种？** | (1) **Manager + agents-as-tools**（父保留最终回复所有权）；(2) **Handoffs**（专员接管该分支对话）；(3) **Deterministic pipeline**（脚本/图固定步骤顺序，LLM 只填步骤内部）；(4) **Agent teams / dynamic workflows**（Claude Code：多会话协同或脚本驱动大批量 subagent——实验/进阶）。 |
| **D. IDE 与 Builder 差异** | Coding IDE 的 subagent 主要解决 **对话 context 污染与并行**；AI website builder 公开叙事多为 **Plan → 单 Build agent 拥有整树**（见 chrome-shell 调研）。open-ox 的「多角色硬拆」更接近 **deterministic pipeline + 并行 page workers**，不是 IDE 式「运行时动态 spawn」。 |
| **E. open-ox 现状** | **没有**通用 nested-subagent 运行时；是手写 orchestrator（`runGenerateProject` / `runModifyProject`）调用 tool-loop。并行主要是 `Promise.all` 页级 agent。Modify 另有一套 `loopEngine`。 |
| **F. 最大架构债** | 术语「Agent」过载（pipeline step / tool-loop role / 交互 Intent / BoardRun card 都叫 agent）；双 Intent 入口；双 tool-loop；chrome-first 后遗命名；上帝编排文件。整合应先 **统一词汇与合同**，再谈是否引入真正的 spawn API。 |

**一句话**：行业共识是 **「子代理 = 隔离上下文的委托单元」**；open-ox 今天已经有 **角色化并行 workers**，但缺 **统一的 Agent Runtime / 委托语义**。升级路径应是：先整理「编排层 vs 执行层 vs 委托层」，把适合隔离/并行/验证的场景做成真正的 subagent，其余保持确定性管线步骤——而不是再堆更多 `*Agent.md`。

---

## 2. Agent vs Subagent：第一方定义对照

### 2.1 Cursor

**定义**：Subagents are specialized AI assistants that Cursor's agent can delegate tasks to. Each operates in its **own context window**, handles specific work, and **returns its result to the parent**. Use to break down complex tasks, work in parallel, and preserve main-conversation context.

来源：[Cursor Docs — Subagents](https://cursor.com/docs/subagents)

**内建三类**（因「中间输出吵、吃上下文」而做成 subagent）：

| Subagent | 用途 | 为何是 subagent |
|----------|------|-----------------|
| Explore | 代码库搜索分析 | 中间搜索结果膨胀；可用更快模型并行搜 |
| Bash | 系列 shell | 日志冗长，父只需决策结果 |
| Browser | MCP 浏览器 | DOM/截图噪声大，需过滤后回报 |

**核心收益（官方原文要点）**：context isolation、parallel execution、specialized config、cost efficiency（重活用更便宜/更快模型）。

**Skills vs Subagents（官方表）**：

| 用 subagent 当… | 用 skill 当… |
|-----------------|--------------|
| 长研究需隔离上下文 | 单目的、可重复短动作 |
| 多 workstream 并行 | 一次完成即可 |
| 多步专精任务 | 不需要独立 context |
| 独立 verification | — |

Changelog 2.4 将 subagents 描述为 *independent agents specialized to handle discrete parts of a parent agent's task*；可自定义 prompt / tools / model。来源：[Cursor Changelog 2.4](https://cursor.com/changelog/2-4)

### 2.2 Claude Code（Anthropic）

**定义**：Subagents handle specific task types. **Use when a side task would flood the main conversation** with search results, logs, or file contents you won't reference again — the subagent works in its own context and returns only the summary.

来源：[Create custom subagents](https://code.claude.com/docs/en/sub-agents)、[Run agents in parallel](https://code.claude.com/docs/en/agents)

**并行手段分层（官方对照表）**：

| Approach | 给什么 | 何时用 |
|----------|--------|--------|
| **Subagents** | 同会话内委托，独立上下文，回报摘要 | 侧任务会淹没主对话 |
| **Agent view** | 调度/监控多个后台 session | 多个独立任务，你间歇介入 |
| **Agent teams** | Lead + teammates + 共享任务列表（实验，默认关） | Claude 拆分并监督一组工人 |
| **Dynamic workflows** | 脚本跑大量 subagent 并交叉验证 | 超出「几次委托」、需多角度核对 |

另：**Worktrees** 隔离并行写文件；**forked subagent** 继承完整对话上下文（仍是 spawn 方式，不是独立产品面）。

### 2.3 VS Code Copilot

**定义**：A subagent is an **independent AI agent** that performs focused work (research, analyze, review) and **reports results back to the main agent**.

官方场景清单（[Subagents in VS Code](https://code.visualstudio.com/docs/copilot/agents/subagents)）：

1. Research before implementation（隔离调研，主 agent 只收推荐）
2. Parallel code analysis（重复代码 / dead code / 错误处理 / 安全并行）
3. Explore multiple solutions（多方案并排，不污染主上下文）
4. Code review with specialized focus（security / performance / a11y 并行）
5. Multi-model consensus（不同模型审同一问题）

**编排模式（官方）**：Coordinator + workers（Planner / Architect / Implementer / Reviewer）；worker 可缩小工具面与模型成本。默认 **禁止** subagent 再 spawn（防递归）；可选开启嵌套，深度上限 5。

### 2.4 OpenAI Agents SDK

**关键分叉点**：谁拥有 **面向用户的最终回复**。

| Pattern | 何时 | 发生什么 |
|---------|------|----------|
| **Handoffs** | 专员应接管该分支 | 控制权移交到 specialist |
| **Agents as tools** | Manager 应保持控制 | Manager 调用 specialist 作为有界能力，自己合成答复 |

来源：[Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)、[Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)

**反膨胀原则（官方）**：**Start with one agent whenever you can.** Add specialists only when they materially improve capability isolation, policy isolation, prompt clarity, or trace legibility. Splitting too early creates more prompts, more traces, and more approval surfaces.

---

## 3. 适合引入 Subagent 的场景目录（可复用检查表）

下列每条都绑定至少一家第一方「何时用」表述；用于评估 open-ox 某一步是否「值得变成真 subagent」。

| # | 场景 | 判定信号 | 第一方锚点 | open-ox 对照（§7） |
|---|------|----------|-----------|-------------------|
| S1 | **噪声侧任务**（搜索/日志/浏览器/截图 DOM） | 中间 token 父侧用不上 | Cursor Explore/Bash/Browser；Claude「flood main conversation」 | analyze web/reference、build 日志、未来视觉 QA |
| S2 | **并行独立 workstream** | 任务可分区、文件所有权不重叠 | Cursor parallel Task；VS Code parallel analysis；Claude worktrees | 已有：并行 `page_implement_agent`；可加强：并行 research 方案 |
| S3 | **专精多步角色** | 需要独立 system prompt + 工具白名单 + 多轮 tool loop | Cursor/Claude custom subagents；VS Code custom agent as subagent | Scaffold / Page / Chrome Optimize / Repair **已是角色化 tool-loop**，但是 **编排器硬调度**，不是父 LLM 动态委托 |
| S4 | **独立 verification** | 实施者自评不可信 | Cursor verifier pattern；VS Code multi-perspective review | 可加：build 后「skeptical verifier」；今日多靠 typecheck/repair |
| S5 | **多方案探索后择一** | 探索过程不应进主上下文 | VS Code「explore multiple solutions」 | Plan / design intent 可拆「方向探索 subagent」 |
| S6 | **模型分流 / 成本** | 子任务可用更快更便宜模型 | Cursor explore 更快模型；VS Code worker 用小模型 | Page 批量生成、依赖解析等候选 |
| S7 | **策略/工具面隔离** | 读写权限或 policy 必须不同 | OpenAI「policy isolation」；Claude tools/disallowedTools；VS Code readonly workers | Page 禁写 chrome；Intent 只读探索——已有工具面差异，缺统一声明 |
| S8 | **用户对话 ownership 切换** | 下一回合应由另一专员直接对用户说话 | OpenAI **handoffs** | Intent Agent ↔ Generate 更像 **pipeline handoff**（API/job 切换），不是同 run 内 handoff |
| — | **不适合做成 subagent** | 单次 LLM 调用、确定性脚本、纯数据变换 | Cursor：用 skill；OpenAI：先单 agent | tokens apply、stub 写入、`run_build` 确定性步骤 |

**经验法则（综合 A 源，标 C）**：

> 若一步的价值主要是 **「固定顺序里的生产阶段」** → 保持 **pipeline step**。  
> 若一步的价值主要是 **「隔离上下文 / 并行 / 独立验证 / 动态是否调用」** → 才值得 **subagent spawn**。

---

## 4. 主流 Coding IDE 的架构见地

### 4.1 共同层（Cursor ≈ Claude Code ≈ VS Code）

```
User-facing Agent (modes: Agent / Plan / Ask / Debug …)
        │
        ├─ Skills / prompts（短、可注入、无独立 context）
        ├─ Tools（FS / shell / MCP）
        └─ Subagent spawn（独立 context → 摘要回报）
                 ├─ built-in（Explore / Bash / Browser / Plan…）
                 └─ custom（.cursor/agents | .claude/agents | .agent.md）
```

共同设计选择：

1. **Context isolation 是一等公民**，不是可选优化。
2. **父必须在 prompt 里塞齐上下文**（子默认不共享历史；Claude 另有 forked 变体）。
3. **工具与模型可按角色收缩**。
4. **嵌套默认受限**（防递归爆炸）。
5. **Verifier / Reviewer** 作为对抗「虚假完成」的标准模式。

### 4.2 OpenAI 补上的产品化语言

- **Agents as tools** ≈ IDE 的 subagent（manager 合成）。
- **Handoffs** ≈ 客服/路由型产品面（专员对用户说话）——IDE 较少强调，但对 **Intent → Build** 类产品有直接隐喻。
- **「合同变化才拆分」** 是防 agent sprawl 的明确规范。

### 4.3 AI Builder（Lovable / v0 / Bolt 等）公开面

详见 [chrome-shell 调研](./ai-builder-chrome-shell-pipelines-20260715.md)：公开叙事多为 **Plan（决策）→ 单 Build agent（执行整树）**，**未公开** Page/Chrome 双 agent 硬拆。对 open-ox 的启示不是「拆掉并行 page workers」，而是：

- 对用户呈现的应是 **少量模式**（澄清 / 计划 / 构建 / 修改），而非十几个内部角色名；
- 内部并行与所有权锁可以保留，但应落在 **orchestrator 合同**，不要伪装成「用户可见的多 agent 产品」。

---

## 5. 反模式 / Sprawl 问题（第一方点名 + 映射）

| 反模式 | 谁点名 | 症状 | open-ox 是否已见（B） |
|--------|--------|------|----------------------|
| **过早拆 specialist** | OpenAI orchestration | 更多 prompt/trace/approval，无隔离收益 | 部分：命名上「到处是 Agent」，合同未统一 |
| **简单任务做成 subagent** | Cursor skills vs subagents | 启动开销大、上下文空转 | 风险：把单次 LLM step 也称为 Agent |
| **子任务文件所有权重叠并行** | Claude worktrees 指引 | 并行写冲突 | Page 并行靠 slug/路径约定；chrome 靠禁写 |
| **嵌套无上限** | VS Code 默认禁嵌套 | 递归委托失控 | 今日无 spawn API，风险低；引入后需硬上限 |
| **角色名漂移 / 双实现** | （推断 C） | 同一职责两套 prompt/loop | **是**：Architect 双名、双 Intent、双 tool-loop、chrome-deferred 残名 |
| **Board/Team 名暗示并行但串行** | （推断 C） | 运维与产品预期错位 | BoardRun **串行** cards |

---

## 6. open-ox 现状地图（B：本仓库）

### 6.1 双主流程

```
Studio / API
  ├─ Intent Agent（SSE 多轮）──commit──► Generation Job
  │                                         └─ runGenerateProject（确定性编排）
  │                                              ├─ 并行：analyze ∥ design intent
  │                                              ├─ 并行：plan ∥ design system
  │                                              ├─ 串行：tokens → scaffold → stubs
  │                                              ├─ 并行：page_implement × N
  │                                              ├─ 串行：chrome_optimize
  │                                              └─ build / repair loop
  └─ Modify（SSE）── runModifyProject
                       ├─ intent router / plan
                       ├─ loopEngine（独立 tool loop）
                       └─ BoardRun：串行卡片，每张再进 modify
```

关键源：`ai/flows/generate_project/runGenerateProject.ts`、`ai/flows/modify_project/runModifyProject.ts`、`ai/shared/llm/toolLoop.ts`、`ai/flows/modify_project/engine/loopEngine.ts`、ADR-0005。

### 6.2 「Agent」一词当前指什么（过载）

| 称呼 | 实际机制 | 更贴切的词 |
|------|----------|-----------|
| Intent Agent | 交互式多轮 tool-loop + yield | **User-facing Agent**（handoff 到 job） |
| `project_intent_guide` | 管线内门闸 LLM | **Pipeline gate step** |
| Architect Scaffold / Page / Chrome Optimize / Section Replica | 编排器调度的 tool-loop 角色 | **Role worker**（硬调度；类 subagent 但无动态 spawn） |
| `plan_project` / `infer_design_intent` 等 | 多为单次或短工具调用 | **Pipeline LLM step** |
| Modify agent | 长生命周期 ReAct + hooks | **User-facing Agent**（IDE 味最浓） |
| BoardRun card | 串行再入 modify | **Queued turn**（非并行 subagent） |

### 6.3 已知混乱点（整合候选）

1. **Chrome-first 迁移残渣**：`createPageAgentChromeDeferredWriteExecutor` 等命名/注释仍带 deferred；Optimize 职责是 link polish，部分文案仍像「拥有 chrome」。
2. **Architect 双轨**：运行时 `architect_scaffold_agent`；shim `architectAgent.ts`；orphan `architectAgent.md`。
3. **双 Intent**：交互 `intentAgent` vs 管线内 `project_intent_guide`。
4. **双 Tool Loop**：Generate → `toolLoop.ts`；Modify → `loopEngine.ts`（stop hooks / compression / gate 不共享）。
5. **工具目录分裂**：核心 `systemToolCatalog` + 各步 ad hoc 工具。
6. **上帝编排器**：`runGenerateProject.ts` 体量大，边界情况所有权集中。
7. **BoardRun 语义**：名暗示看板并行，实为串行。

---

## 7. 对 open-ox 的含义与整合建议（C：映射建议）

### 7.1 不要先上「通用 Subagent 框架」

与 Cursor/Claude 不同，open-ox 的 generate **成功关键已是确定性所有权管线**（chromeForm → scaffold → pages → optimize）。把整条管线改成「父 LLM 自由 spawn」会牺牲可重复性与 chrome 不变量（ADR-0005）。

**推荐分层**：

| 层 | 职责 | 技术形态 |
|----|------|----------|
| **Orchestrator** | 步骤顺序、并行扇出、checkpoint、所有权锁 | 代码（保持） |
| **Role worker** | 有界 tool-loop + prompt + 工具白名单 | 今日的 Scaffold/Page/…；逐步统一 runtime |
| **Subagent（新增，克制）** | 可选委托：隔离噪声 / 验证 / 探索 / 贵模型分流 | spawn API，**由 orchestrator 或 Modify 父 agent 调用** |
| **User-facing Agent** | Intent / Modify 对用户说话 | 明确 handoff 合同到 Generate Job |

这对应 OpenAI 的 **manager + agents-as-tools**（编排器或 Modify 父保持所有权），而不是把 generate 改成全 handoff 网。

### 7.2 优先适合做成「真 Subagent」的 open-ox 场景

| 优先级 | 场景 | 为何符合 S1–S7 | 建议形态 |
|--------|------|----------------|----------|
| P0 | **Modify 内：探索 / 日志噪声任务** | S1；Modify 已是长对话，最怕上下文膨胀 | 父 `loopEngine` 可 `spawn_subagent(explore|bash-summary)` |
| P0 | **Build/Repair 后的 Verifier** | S4；对抗虚假完成 | readonly + 跑检查，只回报 pass/fail 列表 |
| P1 | **并行 Page workers 的统一 Runtime** | S2/S3；已有并行，缺标准合同 | 不必改产品语义；把「启动参数 / 禁写路径 / 完成契约」做成 SubagentSpec |
| P1 | **Intent 阶段的参考站调研** | S1/S5 | 子代理抓参考站，父只收结构化 brief |
| P2 | **多设计方向探索** | S5/S6 | 小模型并行出 2–3 方向，父择一进 design system |
| P2 | **视觉/浏览器 QA**（若引入） | S1 Cursor Browser | 截图+DOM 噪声绝不应进主 modify 上下文 |
| — | **不要**把 tokens apply / stubs / run_build 做成 subagent | 违反 Cursor skills 边界 | 保持确定性 step |

### 7.3 整合优化清单（建议顺序）

1. **词汇表进 CONTEXT.md / architecture.md**  
   固定：User-facing Agent / Pipeline Step / Role Worker / Subagent / Handoff。禁止新代码再把确定性步骤命名为 `*Agent`，除非它是 tool-loop worker。

2. **消灭双轨命名**  
   删除或归档 orphan `architectAgent.md`；rename chrome-deferred 符号；BoardRun 文档写明 serial queue。

3. **收敛 Intent**  
   产品面只保留一条「澄清」入口；`project_intent_guide` 降为 worker 内 fortification 或删除重复提问。

4. **统一 Agent Runtime（执行层）**  
   将 Modify 的 stop hooks / compression / tool gate 能力下沉为共享 runtime；Generate role workers 与未来 subagent 都挂同一 loop。这是「技术升级」的真正底座，比再写三个 `*Agent.md` 更重要。

5. **统一 Tool Policy 声明**  
   每个 Role/Subagent：`tools` / `disallowedPaths` / `readonly` / `modelTier`——对齐 Claude/Cursor frontmatter 思想（实现可以是 TS registry，不必抄 markdown 文件）。

6. **克制引入 spawn**  
   第一批只做：Modify explore-summary、Verifier。Generate 并行 page **继续由 orchestrator `Promise.all`**，但实现上可复用同一 SubagentRunner。

7. **用户可见面保持简单**  
   Studio 对外：Clarify → Plan/Preview → Build → Modify。内部 Role Worker 名称不要泄漏为产品多 Agent 营销（对齐 Lovable/v0 公开简洁面）。

### 7.4 目标架构草图（整合后）

```
                    ┌─ Intent Agent (user-facing) ─┐
                    │  optional research subagent   │
                    └───────────┬───────────────────┘
                                │ handoff (job)
                                ▼
                     Generate Orchestrator (code)
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
     LLM Steps            Role Workers           Subagents (rare)
  (plan, tokens…)     (scaffold, pages×N,     (verifier, explore)
                       chrome optimize)         via shared Runtime
                                │
                                ▼
                          Build / Repair
                                │
                     Modify Agent (user-facing)
                     + BoardRun serial queue
                     + spawn subagents for noise/verify
```

---

## 8. 与 chrome-first 管线的关系

- chrome-first（ADR-0005）解决的是 **文件系统所有权与双重导航**，不是 subagent 问题。
- 竞品公开面偏向单 agent 整树；open-ox 保留硬拆是为了 **并行吞吐 + 所有权锁**——这在 IDE 术语里更接近 **orchestrated parallel role workers**，不是「用户可见的多 Agent 产品」。
- 引入 subagent 时 **不要**让 Page worker 动态再 spawn「写 chrome」的子代理；chrome 合同必须留在 Orchestrator。

---

## 9. 开放问题

1. Modify 与 Generate 是否共享同一 credit/trace 语义下的 SubagentRunner？还是 Modify-only 先行？
2. Verifier 失败时：自动回灌 Repair，还是停给用户？（Cursor verifier 模式偏报告）
3. Intent 的 research subagent 是否允许写盘，还是纯结构化 JSON 回报？
4. 是否需要 Claude 式 **worktree 隔离** 做并行实验生成（成本高，builder 场景未必值得）？

---

## 10. Sources appendix

### A. 官方 / 第一方

- [Cursor Docs — Subagents](https://cursor.com/docs/subagents)
- [Cursor Changelog 2.4 — Subagents, Skills](https://cursor.com/changelog/2-4)
- [Cursor Help — Agent mode](https://cursor.com/help/ai-features/agent)
- [Claude Code — Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code — Run agents in parallel](https://code.claude.com/docs/en/agents)
- [VS Code — Subagents](https://code.visualstudio.com/docs/copilot/agents/subagents)
- [VS Code — Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [VS Code 1.110 release notes — Explore subagent for Plan](https://code.visualstudio.com/updates/v1_110)
- [OpenAI — Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI Agents SDK — Multi-agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)
- [OpenAI — A practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)

### B. 本仓库

- `docs/adr/0005-chrome-first-generate-pipeline.md`
- `docs/product/chrome-first-generate-pipeline-architecture.md`
- `docs/architecture.md`
- `CONTEXT.md`
- `ai/flows/generate_project/runGenerateProject.ts`
- `ai/flows/modify_project/runModifyProject.ts`
- `ai/shared/llm/toolLoop.ts`
- `ai/flows/modify_project/engine/loopEngine.ts`
- 对照调研：[ai-builder-chrome-shell-pipelines-20260715.md](./ai-builder-chrome-shell-pipelines-20260715.md)

### C. 本笔记中的映射建议

§7 全部为将 A 映射到 B 的工程建议，非任何厂商对 open-ox 的承诺。
