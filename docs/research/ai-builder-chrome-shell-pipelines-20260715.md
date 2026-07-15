# 调研：竞品 AI Website/App Builder 如何处理 Global Chrome / App Shell vs Page Content（2026-07-15）

**状态**：完成（基于第一方公开材料：官方 docs、第一方 blog、厂商自托管 help、公开 GitHub/system prompt、学术第一方项目页；**未登录**各产品内部编排器，未把 SEO 合集当证据）  
**日期**：2026-07-15  
**问题**：主流 AI website/app builders 在生成时如何处理 **global chrome / app shell / navigation** 与 **page content**？是硬拆（如独立 Chrome Agent + Page Agent），还是单一 agent 自主规划 shell？相对 open-ox 的 chrome-deferred 管线，架构是否本质不同？

**范围说明**：

1. 必查：Lovable、v0、Bolt.new / StackBlitz、Replit Agent、Cursor（仅第一方多 agent / Plan 文档）。
2. 可选：Emergent、Softgen、Same.new、Framer AI——仅在有第一方架构线索时记录。
3. 开源对照：bolt.diy（Bolt 官方 OSS 近亲）、OpenHands、smol-ai/developer、Aider；学术：MetaGPT、ChatDev、MM-WebAgent——仅当明确谈到 layout/shell/nav 所有权时展开。
4. **不把**「Top 10 AI builders」类文章当作架构证据。
5. open-ox 当前 chrome-deferred 流程仅作**对照语境**（非一手来源主张）。

**Open-OX 对照语境**（用户提供，非竞品来源）：

- Deferred chrome：pass-through layout → Page Implement Agent(s) 写页（禁止写 chrome）→ Chrome Optimize Agent 统一挂 Nav/Footer。
- 失败模式：Page Agent 仍在页内写顶栏/底栏 Tab；Chrome Agent 再加 sticky top nav → 双重导航。
- 争议补丁：检测到页内 chrome 信号则确定性跳过 Chrome Agent——用户认为不应做成硬规则，应由 agent 自主规划。

---

## 1. 结论摘要（先读）

| 问题 | 一手材料能支持的答案 |
|------|---------------------|
| **A. 两阶段 shell↔pages，还是单 agent？** | 主流商业产品公开叙事几乎都是 **单一 Build/Agent 拥有整棵项目树**；Plan 是「先想后写」的用户模式，不是独立 Chrome Agent。开源 bolt.diy 明确要求 **SINGLE comprehensive artifact + HOLISTIC** 一次生成。**未发现**与 open-ox 同构的「Page Agent 禁止 chrome / Chrome Agent 后置挂载」产品文档。 |
| **B. 谁决定 chrome 形态？** | 多为 **prompt + 实施 agent 涌现**；可选 **用户在 Plan/Design guidance 里选 layout**（Lovable：sidebar / feed 等 wireframe）；或用户在首 prompt 写死（Replit 教程：mobile bottom nav / desktop dashboard）。未见固定「产品 taxonomy → 强制 chromeForm」的公开流水线。 |
| **C. 如何避免双重导航？** | **几乎无人公开文档化**。最近似：Lovable 允许 prompt 护栏「不要改 Layout」；Framer 用 **Layout Templates** 把 header/footer 放进共享 layout（产品能力，非生成管线去重）；学术 MM-WebAgent 用 **Global refine** 做布局一致性。 |
| **D. App vs marketing 管线是否分叉？** | **部分产品在「设计前置」上分叉，而非 chrome 所有权分叉**：Lovable Design guidance 对 landing/portfolio 出三方向，对 dashboard/admin/games **跳过**设计步骤；Replit 教程对 app 明确指定底栏导航。未见「marketing 用 deferred chrome、app 用 page-owns-chrome」的公开双管线。 |
| **E. open-ox 硬拆是否常见？** | 在已查第一方材料中属 **outlier（罕见）**。同业公开模式是单 agent 全栈 + 可选 Plan，而非硬编码「页不得拥有 chrome」。 |
| **F. 仍保留自主规划的替代架构？** | 见 §6：Architect/Plan 先定 chromeForm；单 agent 共有 layout+pages；app 允许 page-owns-chrome；critique/repair（浏览器/截图/global refine）；用户可编辑 plan 再 Build。 |

**一句话**：同业公开架构偏向 **「一个 agent 整体想清楚再写（可先 Plan）」**；open-ox 的 **硬角色拆分 + chrome deferred** 在第一方材料里几乎找不到对标，双重导航也几乎无人讨论——因此「确定性 skip Chrome Agent」更像局部启发式，而不是行业标准做法。

---

## 2. 竞品对照表

| 产品 | 公开生成模型 | Shell / Nav 如何出现 | 是否硬拆 Chrome/Page Agent | 双重导航防护 | 一手来源 | 不透明度 |
|------|-------------|---------------------|---------------------------|-------------|---------|---------|
| **Lovable** | Plan（推理/可编辑 plan）→ Build（端到端改多文件） | 教程：早期写清 navigation；脚手架→空页→细化；Design questions 可选 sidebar/feed 等 layout | **未公开**硬拆；Build「takes ownership end to end」 | 仅见用户护栏示例：`Do not modify … Layout.tsx` | [Plan](https://docs.lovable.dev/features/plan-mode)、[Build](https://docs.lovable.dev/features/agent-mode)、[Prompting](https://docs.lovable.dev/prompting/prompting-one)、[Tutorials](https://docs.lovable.dev/introduction/video-tutorials)、[Design guidance](https://docs.lovable.dev/features/design-guidance) | 高：无内部编排图 |
| **v0** | 单 chat agent + tools（search/browser/terminal） | 推荐先 UI layout 再数据层；`layout.tsx` 作全局字体/CSS 挂载点；多 chat 共享同一 Project FS | **未公开** Chrome/Page 角色拆分 | 未文档化；browser use 可「critique designs」 | [Full-stack](https://v0.app/docs/full-stack-apps)、[Agentic](https://v0.app/docs/agentic-features)、[Design systems](https://v0.app/docs/design-systems)、[Projects](https://v0.app/docs/projects) | 高 |
| **Bolt.new** | 单 Bolt Agent（Standard/Max）；Plan 可先造 base structure | 官方建议先 core pages + **Set up navigation**，再增量功能 | **未公开**硬拆；OSS bolt.diy：**单 artifact 整体生成** | 未文档化 | [Agents](https://support.bolt.new/building/using-bolt/agents)、[Plan](https://support.bolt.new/best-practices/discussion-mode)、[Token efficiency](https://support.bolt.new/best-practices/maximizing-token-efficiency)、[bolt.diy prompts](https://github.com/stackblitz-labs/bolt.diy/blob/main/app/lib/common/prompts/prompts.ts) | 中（OSS 可窥 prompt） |
| **Replit Agent** | Plan → 任务列表 → Build；Lite/Economy/Power | 首 prompt 可直接规定 bottom nav / dashboard layout；Agent「plans, generates, and wires up」 | **未公开** chrome 专属 agent；有并行 background tasks（非 chrome 所有权） | 未文档化 | [Overview](https://docs.replit.com/references/agent/overview)、[Plan vs Build](https://docs.replit.com/learn/plan-vs-build-mode)、[First app](https://docs.replit.com/build/your-first-app) | 高 |
| **Cursor** | Plan Mode → 单一 Agent 实施；Cloud Agents / hooks 可有 subagent | 通用软件工程 Plan，**无** website chrome 所有权模型 | 有 subagent hooks，**非** Page/Chrome 产品角色 | 未涉及 | [Plan Mode](https://cursor.com/docs/agent/plan-mode)、[Cloud Agents](https://cursor.com/docs/cloud-agent)、[Hooks](https://cursor.com/docs/hooks) | 中（文档丰富但非 builder 管线） |
| **Framer Agents** | 单 Agent 在 canvas 生成；建议 section-by-section | 共享 header/footer 靠 **Layout Templates**（产品结构），非生成后 chrome agent | **无** | Layout Templates 降低跨页不一致风险（非自动去重双重 nav） | [How to use Agents](https://www.framer.com/help/articles/how-to-use-agents/)、[Layout Templates](https://www.framer.com/help/articles/how-to-make-templates-easier-to-edit/) | 中 |
| **Softgen** | 「AI analyzes → Generates full-stack code」四步营销叙事 | 未谈 shell | 未知 | 未知 | [How Softgen Works](https://academy.softgen.ai/resources/how-it-works) | 极高 |
| **Emergent** | 对话式 agentic；有 **Mobile Agent**、testing **subagent** | Mobile：Expo 结构由 Mobile Agent 一体搭建；测试可点名 frontend testing subagent | 有**领域** agent（Mobile），**非** chrome/page 硬拆文档 | 未谈双重导航 | [Welcome](https://help.emergent.sh/welcome)、[Mobile](https://help.emergent.sh/mobile-app-development) | 高 |
| **Same.new** | 「agentic environment」一句话 | 未谈 | 未知 | 未知 | [Introduction](https://docs.same.new/get-started/introduction) | 极高 |
| **OpenHands** | ReAct + 可选层级委派 sub-agent | 通用 coding agent，**无** chrome 所有权 SOP | 可委派，非产品级 Chrome Agent | 未针对 nav 去重 | [SDK overview](https://docs.openhands.dev/sdk/arch/overview)、[arXiv:2511.03690](https://arxiv.org/abs/2511.03690) | 中 |
| **smol developer** | plan → file paths → per-file generate（共享 deps） | 整库脚手架；无 chrome 专属阶段 | **否**（按文件切，不按 shell/page） | 靠 shared plan 一致性，非去重规则 | [smol-ai/developer](https://github.com/smol-ai/developer) | 低（代码可读） |
| **MM-WebAgent** | 层级：Global layout → Local elements → multi-level refine | **先全局 layout，再局部内容**；Global refine 用 HTML+截图保一致性 | **有层级分工**，但是 **webpage section/layout**，不是 Next.js Nav/Footer Agent | Global/Context refine 针对错位/一致性 | [MM-WebAgent](https://microsoft.github.io/MM-WebAgent/)、[arXiv:2604.15309](https://arxiv.org/abs/2604.15309) | 低（方法公开） |
| **MetaGPT / ChatDev** | Architect/PM/Engineer 等 SE 角色；或 design→coding→testing | Architect 出系统设计/文件结构；**未**定义 chrome vs page UI 所有权 | 角色按工程阶段，非 chrome deferred | 未涉及 | [MetaGPT](https://arxiv.org/html/2308.00352v7)、[ChatDev](https://arxiv.org/pdf/2307.07924) | 中 |

---

## 3. 分产品摘录（第一方）

### 3.1 Lovable

**模式**：Plan / Build 是 **决策 vs 执行** 的用户模式，不是 Chrome/Page 双 agent。

- Plan：「never modifies your code」；可产出含 *Components, data models, and APIs* 与 *Step-by-step implementation sequencing* 的可编辑 plan；批准后切 Build「based strictly on the approved plan」。来源：[Plan mode](https://docs.lovable.dev/features/plan-mode)。
- Build：「takes ownership of execution end to end… applies changes across files」。来源：[Build / Agent mode](https://docs.lovable.dev/features/agent-mode)。
- 护栏示例（用户可指定，非管线强制）：`Add a new feature to @src/pages/dashboard. Do not modify @src/shared/Layout.tsx or the existing authentication logic.` 同页。

**Shell / Nav 实践建议（仍是单一 agent 工作流）**：

- 教程：「outline **navigation**, page structures, and design themes early」；脚手架 → empty pages → refine。来源：[Video tutorials](https://docs.lovable.dev/introduction/video-tutorials)（Calorie Tracking / Ruta 侧边栏段落）。
- Prompting：「**Prompt by component, not page**」；layout prompt 模式；示例含 floating menu bar。来源：[Prompting best practices](https://docs.lovable.dev/prompting/prompting-one)。
- Design guidance：对营销类可问 **Layout** wireframe（含 **sidebar / feed / gallery** 等）；对 **dashboards, admin panels, internal tools, and games** **跳过** design guidance，直接标准 build。来源：[Design guidance](https://docs.lovable.dev/features/design-guidance)。

**未知**：是否内部存在隐藏的 layout 专属子 agent；docs 未说。

### 3.2 v0 by Vercel

**模式**：单一智能 agent + 工具；多 chat 共享同一 Project 文件系统与部署。来源：[Agentic features](https://v0.app/docs/agentic-features)、[Projects](https://v0.app/docs/projects)。

- 全栈推荐增量：「**Start with UI** — Create your component layout and design」再加 data layer。来源：[Full-stack apps](https://v0.app/docs/full-stack-apps)。
- `layout.tsx` 被描述为全局字体与 CSS 导入点（设计系统语境），不是「Chrome Agent 专属阶段」。来源：[Design systems](https://v0.app/docs/design-systems)。
- Browser use：「open the apps it builds… **critique designs**… fix things proactively」。来源：[Agentic features](https://v0.app/docs/agentic-features)——这是 **critique/repair** 路径，而非硬拆所有权。

**未知**：chat-to-app 内部是否多模型编排；无公开「禁止 page 写 nav」规则。

### 3.3 Bolt.new / StackBlitz / bolt.diy

**产品侧**：

- 一个 Bolt Agent（Standard / Max）「plan your project, write code, and troubleshoot」。来源：[Choose an agent](https://support.bolt.new/building/using-bolt/agents)。
- Plan from homepage：「**starts by creating the base structure of your app**. After that, it shares a plan…」。来源：[Plan / Discussion Mode](https://support.bolt.new/best-practices/discussion-mode)。
- Token efficiency：「Create your **core pages**… **Set up navigation**… Keep the design consistent」再增量功能。来源：[Maximize token efficiency](https://support.bolt.new/best-practices/maximizing-token-efficiency)。

**OSS 近亲 bolt.diy（可读 prompt，不等于商业 Bolt 内部实现，但同族）**：

> 「Bolt creates a **SINGLE, comprehensive artifact** for each project… **Think HOLISTICALLY and COMPREHENSIVELY** BEFORE creating an artifact… Consider ALL relevant files…」  
> UX 指令含「**Design intuitive navigation** and map user journeys。」  
来源：[app/lib/common/prompts/prompts.ts](https://github.com/stackblitz-labs/bolt.diy/blob/main/app/lib/common/prompts/prompts.ts)。

README 将「Backend Agent Architecture — Move from single model calls to agent-based system」标为 roadmap，暗示当前仍偏单调用/单系统 prompt。来源：[stackblitz-labs/bolt.diy README](https://github.com/stackblitz-labs/bolt.diy?tab=readme-ov-file)。

**与 open-ox 对比**：公开材料是 **整体一次性/同会话改全树**，不是 pages-then-chrome 硬阶段。

### 3.4 Replit Agent

**模式**：Plan（只读，任务列表）→ 用户批准 → Build 实施。来源：[Plan vs Build](https://docs.replit.com/learn/plan-vs-build-mode)、[Agent overview](https://docs.replit.com/references/agent/overview)。

**Chrome 形态如何进入系统**：官方「first app」把导航写进 **用户 prompt 的 Data and navigation 段**：

> 「On mobile, use **bottom navigation** for Home, Add Run, and Progress; on desktop, use a **dashboard-style layout**.」  
来源：[Build and publish your first app](https://docs.replit.com/build/your-first-app)。

随后：「Agent **plans, generates, and wires up** the app」——仍是单一 Agent 叙事。同页。

并行能力（background tasks）存在于 overview，**未**描述为 chrome 所有权拆分。来源：[Agent overview](https://docs.replit.com/references/agent/overview)。

### 3.5 Cursor / Composer / Cloud Agents

- Plan Mode：澄清 → 调研代码库 → 可编辑 plan → Build。来源：[Plan Mode](https://cursor.com/docs/agent/plan-mode)。
- Cloud Agents：隔离 VM 上跑同一类 agent；hooks 含 `subagentStart` / `subagentStop`——通用扩展点，**无**「Chrome Agent」产品语义。来源：[Cloud Agents](https://cursor.com/docs/cloud-agent)、[Hooks](https://cursor.com/docs/hooks)。

**结论**：Cursor 文档支持「先自主规划再执行」，**不**支持「page 禁止 chrome / 后置 chrome agent」这类 builder 硬规则。

### 3.6 Framer / Softgen / Emergent / Same（辅）

| 产品 | 可核对点 | 对 chrome 问题的意义 |
|------|---------|---------------------|
| Framer | Agent「generate and update content, **layouts**…」；最佳实践 **单 section**；共享 nav/footer 用 **Layout Templates** | Shell 一致性靠 **编辑器产品原语**，不是生成管线硬拆 |
| Softgen | Describe → AI Generation → Iterate → Deploy | 无架构细节 |
| Emergent | Mobile Agent 一体建 Expo；可调用「**frontend testing subagent**」 | 有 **领域/测试** 子 agent，**无** web chrome/page 硬拆文档 |
| Same.new | 「most capable agentic environment」 | 无架构细节 |

来源见对照表 URL。

---

## 4. 开源与学术：明确谈到 layout / shell 时

### 4.1 按文件切、不按 chrome 切

- **smol developer**：`plan` → `specify_file_paths` → 逐文件 `generate_code`，共享 deps 保一致性。来源：[smol-ai/developer](https://github.com/smol-ai/developer)。**无** Nav Agent。
- **Aider**：repo map 提供符号图上下文，单 coder 改仓库。来源：[Repository map](https://aider.chat/docs/repomap.html)。**无** chrome 角色。
- **OpenHands**：通用 ReAct + workspace；可层级委派。来源：[SDK overview](https://docs.openhands.dev/sdk/arch/overview)。**无** website chrome SOP。

### 4.2 按工程角色切（仍不是 chrome deferred）

- **MetaGPT**：Architect 产出系统接口/架构文档，再交 Engineer——SOP 是软件工程文档流，**不是**「Page 禁 chrome」。来源：[MetaGPT HTML](https://arxiv.org/html/2308.00352v7)。
- **ChatDev**：design / coding / testing 聊天链。来源：[ChatDev PDF](https://arxiv.org/pdf/2307.07924)。

### 4.3 最近似「先全局 layout，再局部内容」：MM-WebAgent

面向 **多模态网页生成**（非 Next.js app shell 产品）：

1. **Global Layout Planning**：section 层级、页面 style、多模态占位。  
2. **Local Element Planning**：按占位生成资产并插入。  
3. **Hierarchical Self Reflection**：Local / Context / **Global refine**（HTML + 渲染截图保证跨 section 一致性）。  

来源：[MM-WebAgent 项目页](https://microsoft.github.io/MM-WebAgent/)、[arXiv:2604.15309](https://arxiv.org/abs/2604.15309)。

**对 open-ox 的映射价值**：这是 **「先定全局结构 + 事后全局 critique」**，不是 **「页禁止写 chrome + 另一 agent 强制挂 Nav」**。若页已自带 immersive chrome，更自然的对标是 **Global refine 合并/删除重复导航**，而非确定性 skip 某一阶段。

---

## 5. 直接回答 A–F

### A. 两阶段还是单 agent？

| 模式 | 谁在用（公开） |
|------|----------------|
| **单 agent 拥有 layout + pages** | Lovable Build、v0、Bolt（+bolt.diy holistic artifact）、Replit Build、Framer Agent、Softgen/Same（叙事） |
| **Plan → 再单 agent 实施** | Lovable、Bolt、Replit、Cursor（用户可选） |
| **Pages-then-shell 或 Shell-then-pages 硬阶段 + 角色禁写** | **未在商业竞品第一方 docs 中找到**；open-ox chrome-deferred 属此类中的「pages then chrome」变体 |
| **层级 global→local（学术）** | MM-WebAgent（网页 layout，非 app chrome agent） |

### B. 谁决定 chrome 形态？

1. **实施 LLM 涌现**（默认）：单 agent 在写全树时自己决定。  
2. **用户 / Plan 文本**：Replit 教程把 bottom nav 写进 prompt；Lovable Plan 可含架构决策。  
3. **轻量产品 taxonomy（设计层，非强制 chrome agent）**：Lovable Design questions 的 layout wireframe（含 sidebar、feed 等），且 **dashboard 类跳过**该步。  
4. **未见**：公开的「固定 chromeForm 枚举 → 强制后置 Chrome Agent」流水线。

### C. 双重导航如何避免？

**诚实结论：第一方几乎不谈。** 可见近亲：

- 用户护栏（Lovable：`Do not modify Layout.tsx`）。  
- 产品级共享 layout（Framer Layout Templates）。  
- 事后视觉/结构 critique（v0 browser critique；MM-WebAgent Global refine）。  

**没有**找到「检测页内 tab bar → 跳过全局 Nav Agent」的竞品文档。

### D. App-like / immersive vs marketing？

- **有分叉，但分叉点是「要不要设计预览 / 用户如何描述导航」，不是 chrome 所有权管线。**  
  - Lovable：营销向 Design guidance；dashboard/admin/games 跳过。  
  - Replit：app 教程直接规定 mobile bottom navigation。  
- **未证实**「marketing 用 deferred chrome、feed/stream app 用 page-owns-chrome」双管线。

### E. open-ox 硬规则常见吗？

在本次一手材料范围内：**罕见 / outlier**。同业主流是 **单 agent（± Plan）整体负责**；硬编码「page must not own chrome / chrome agent owns nav」未见对标产品公开。

### F. 仍让 agent 自主规划的架构替代

| 替代 | 一手锚点 | 相对硬规则 skip 的特点 |
|------|---------|----------------------|
| **Plan/Architect 先输出 chromeForm，人可改，再 Build** | Lovable/Replit/Cursor Plan；Bolt homepage Plan「base structure」 | 自主规划在 Plan，执行受约束但不靠启发式 skip |
| **单 full-stack agent 同时写 layout + pages** | bolt.diy SINGLE/HOLISTIC；Lovable/v0/Bolt Build | 从根上减少「两角色各写一份 nav」 |
| **按产品类型允许 page-owns-chrome（app）** | Lovable 对 dashboard 跳过 design guidance；Replit 教程 page-level bottom nav | 策略分叉在规划层，不是事后检测 skip |
| **Critique / repair 合并重复 nav** | v0 browser critique；MM-WebAgent Global refine | 发现冲突后修复，而非禁止某一 agent 运行 |
| **共享 layout 原语（产品）** | Framer Layout Templates；Next `layout.tsx` 约定（v0 design systems） | 结构上单一 chrome 源，依赖约定而非禁写 prompt |

---

## 6. Implications for open-ox

> **落地状态（2026-07-15）**：已采纳 ADR-0005 与 `docs/product/chrome-first-generate-pipeline-architecture.md`——默认 **chrome-first**（Scaffold 真壳 → 并行页内容 → polish），废弃 chrome-deferred 主路径。`chromeForm` 由 Plan/Scaffold **Agent 判断**，代码与 prompt **禁止** productType→壳形态查表与页内 chrome 检测硬跳过。下文保留调研时的建议原文。

以下为建议，非强制：

1. **不要把「检测到页内 chrome → 确定性 skip Chrome Agent」当成行业标准。** 同业几乎不公开这种硬规则；它可能修掉双重导航，但会与「agent 自主规划」目标冲突，也和 Lovable/Bolt/Replit 的 Plan→Build 叙事不一致。

2. **若要对齐同业公开模式**：优先考虑 **单一实施者拥有 layout+pages**（或 Plan 里先定 `chromeForm`，批准后再写），而不是 Page/Chrome 硬禁写 + 后置挂载。bolt.diy 的 *holistic single artifact* 是可读的极端形式。

3. **若保留多 agent 并行写页（性能理由）**：更接近学术/critique 路径的是 **chromeForm 由 Architect/Plan 先声明** + **收尾 Global refine/去重**（MM-WebAgent / v0 browser），而不是「页永远不能写 chrome」+「有信号就跳过」。

4. **App / immersive 与营销站**：同业用 **prompt/设计前置分叉**（bottom tabs vs marketing top nav），而不是两套所有权管线。可让规划 agent 显式选择 `chromeForm ∈ {top-nav, sidebar, bottom-tabs, none, page-local}`，对 `page-local` / `none` **合法跳过**全局挂载——这是 **计划结果**，不是检测启发式。

5. **双重导航**：行业文档真空意味着这很可能是 **编排器特有失败模式**；修复应偏向 **统一所有权或合并修复**，而非仅 skip。

---

## 7. 来源列表

### 商业 / 产品第一方

- https://docs.lovable.dev/features/plan-mode  
- https://docs.lovable.dev/features/agent-mode  
- https://docs.lovable.dev/prompting/prompting-one  
- https://docs.lovable.dev/introduction/video-tutorials  
- https://docs.lovable.dev/features/design-guidance  
- https://v0.app/docs/full-stack-apps  
- https://v0.app/docs/agentic-features  
- https://v0.app/docs/design-systems  
- https://v0.app/docs/projects  
- https://support.bolt.new/building/using-bolt/agents  
- https://support.bolt.new/best-practices/discussion-mode  
- https://support.bolt.new/best-practices/maximizing-token-efficiency  
- https://docs.replit.com/references/agent/overview  
- https://docs.replit.com/learn/plan-vs-build-mode  
- https://docs.replit.com/build/your-first-app  
- https://cursor.com/docs/agent/plan-mode  
- https://cursor.com/docs/cloud-agent  
- https://cursor.com/docs/hooks  
- https://www.framer.com/help/articles/how-to-use-agents/  
- https://www.framer.com/help/articles/how-to-make-templates-easier-to-edit/  
- https://academy.softgen.ai/resources/how-it-works  
- https://help.emergent.sh/welcome  
- https://help.emergent.sh/mobile-app-development  
- https://docs.same.new/get-started/introduction  

### 开源 / 学术第一方

- https://github.com/stackblitz-labs/bolt.diy  
- https://github.com/stackblitz-labs/bolt.diy/blob/main/app/lib/common/prompts/prompts.ts  
- https://github.com/smol-ai/developer  
- https://docs.openhands.dev/sdk/arch/overview  
- https://arxiv.org/abs/2511.03690（OpenHands Software Agent SDK）  
- https://aider.chat/docs/repomap.html  
- https://microsoft.github.io/MM-WebAgent/  
- https://arxiv.org/abs/2604.15309（MM-WebAgent）  
- https://arxiv.org/html/2308.00352v7（MetaGPT）  
- https://arxiv.org/pdf/2307.07924（ChatDev）  

### 明确未采用的证据类型

- 第三方「Top 10 AI website builders」合集与未署名架构复述。  
- 对闭源产品内部 prompt/编排图的推测（一律标「未知 / 不透明」）。

---

## 8. 调研局限

- 商业 builder **普遍不公开**生成图中的多 agent 拓扑；本文只能证明「公开叙事不是 chrome deferred 硬拆」，不能证明「内部绝无类似拆分」。  
- bolt.diy prompt ≠ 生产 Bolt.new 逐字相同，但提供同族可读证据。  
- Galileo 等未找到足够清晰的第一方架构页，故未展开。  
- open-ox 仓库内 `docs/architecture.md` 对 Architect/Chrome 叙述可能随迭代变化；本文对照以用户给定的 chrome-deferred 语境为准，不把仓库文档当作竞品证据。
