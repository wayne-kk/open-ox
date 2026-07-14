# 调研：主流 AI Website/App Builder 竞品已上线 UX 能力与 Open-OX 提升机会（2026-07-14）

**状态**：完成（基于第一方公开材料：官方文档、帮助中心、changelog、第一方产品页/博文；**未登录**各产品编辑器，UI 细节以文档/公告为准，不臆造）  
**日期**：2026-07-14  
**问题**：主流 AI website/app builder 竞品已**实际上线**哪些新颖 / 差异化 UX？哪些能**净新增** Open-OX 体验，而不是复述本仓库已有想法池？

**范围说明**：

1. 优先竞品：Lovable、v0、Bolt.new、Replit Agent、Cursor（可迁移的 agent UX）、Framer AI、Webflow AI；辅以 Relume、Softgen、Dora、Figma Make、Claude Artifacts/Projects。
2. 只记**一手来源**可核对的已上线能力；第三方评测仅作线索时标「一手来源未证实」。
3. 对照 Open-OX 基线与三份想法池，**刻意避开重复 brainstorm**；机会清单只列净新增或「形态显著不同」的方向。
4. 不实现产品代码；不含实现规格。

**Open-OX 对照基线**（见根目录 [`CONTEXT.md`](../../CONTEXT.md)）：

- 自然语言 → 可运行真实 Next.js；Studio；Design Mode（source-coordinate Direct Apply）；Modify Agent（+ BoardRun）；Workspace；Community Publish Preview + Remix；Credits；BYO Vercel Deploy；飞书等集成。

**已覆盖想法池（本文不重复立项）**：

| 文档 | 已覆盖主题（摘要） |
|------|-------------------|
| [`ux-expansion-ideas-20260710.md`](../product/ux-expansion-ideas-20260710.md) | 蓝图预览、三问 Brief、图拆 section、意图条、Before/After、时光机、说人话失败、上线体检、客户批注、部署剧场、Remix 导览、气质发现、模块 Remix、品牌记忆 |
| [`attraction-ideas-20260713.md`](../product/attraction-ideas-20260713.md) | URL→品牌 remix、气质分叉、增长钩子 |
| [`hermes-agent-ux-scenarios-20260714.md`](../product/hermes-agent-ux-scenarios-20260714.md) | Agent 记忆/看板/cron/多通道协作 |
| `docs/research/lovable-*` 等既有调研 | Visual edits 定位、History/Versions、Community/Remix、Credits 定价等 |

**既有调研（避免重复深挖）**：`lovable-visual-edits-*`、`lovable-history-versions-*`、`lovable-community-publish-remix-*`、`ai-builder-credits-pricing-*`、`studio-visual-extensions-*`。

---

## 1. 问题与范围

### 1.1 要回答什么

竞品**已经 ship** 的具体 UX（非「AI 能建站」泛称），哪些对 Open-OX 仍是**缺口或形态差距**，可转化为可行动的产品方向。

### 1.2 在范围

- 生成前引导 / Plan；Studio 内视觉×代码双模；协作/分享/remix；版本/回滚心智；多 Agent / 任务面；集成与设计系统；响应式创作；上线后反馈→修改；信任与成本透明；模板/从 X 起步。

### 1.3 不在范围（Out of scope）

- 实现规格、排期承诺、对标定价战
- 第三方「Top 10 AI builders」合集作为证据源
- 复述想法池已有条目的完整方案（仅在对照表标 overlap）
- Dora/Galileo/Banani 等若一手材料过薄，只记可核对点，不硬凑百科

---

## 2. 竞品对照表

| 竞品 | 新颖 UX（一手可核对） | 一手来源 | Open-OX gap | 备注 |
|------|----------------------|----------|-------------|------|
| **Lovable** | Preview toolbar：Select / inline text / **Draw annotation** / **pinned comments**；改动能 **queue** | [Preview toolbar](https://docs.lovable.dev/features/preview-toolbar) | **partial** | 意图条/批注想法池有；**画标注 + 可编辑队列**净增 |
| Lovable | **Plan ↔ Build** 模式切换；Plan 后再 Implement | [Changelog](https://docs.lovable.dev/changelog)（Build and Plan mode） | **yes** | 与蓝图不同：聊天内「先讨论后写码」 |
| Lovable | **Prompt queue**：排队、重排、暂停、可重复 N 次 | Changelog（Prompt queue） | **yes** | BoardRun≠用户可见 prompt 队列 |
| Lovable | Inline text：**每日免费配额**（100），超额扣 credits | Preview toolbar FAQ | **yes** | 成本信任 UX |
| Lovable | **SEO & AI search review** + 一键修；GSC / Semrush 研究 | Changelog（SEO and AI search） | **partial** | 重叠 §4.1 体检；SEO/GSC 闭环更具体 |
| Lovable | **Security view** + security memory；Aikido 渗透测 | Changelog | **no→P2** | 偏全栈 app；营销站优先级低 |
| Lovable | Telegram bot 改站；workspace **Skills** playbook；MCP 反控 | Changelog / [MCP](https://docs.lovable.dev/integrations/lovable-mcp-server) | **partial** | 飞书/Hermes 已谈通道；Skills 可净增 |
| Lovable | Analytics on published；Cloud 一体化后端 | [Cloud](https://docs.lovable.dev/integrations/cloud)、MCP analytics tools | **partial** | BYO Vercel≠内建流量洞察 |
| **v0** | Design Mode：**属性面板 + NL**；pending 编辑 **Undo/Redo/Reset + before/after**；Apply → **新 chat version** | [Design mode](https://v0.app/docs/design-mode) | **yes** | Direct Apply 即时写回；缺「暂存批改再提交」 |
| v0 | Chat = **Git branch**；自动 commit；产品内 **Open PR / Merge** | [GitHub](https://v0.app/docs/github) | **yes** | 强化「真实工程」叙事 |
| v0 | **多 Chat → 同一 Project**（共享 FS/部署/env）；Folders vs Projects | [Projects](https://v0.app/docs/projects)、[Quickstart](https://v0.app/docs/quickstart) | **yes** | Workspace 项目≠多会话共仓 |
| v0 | Agentic：web search、browser use、terminal 权限档、Marketplace 集成 | [Agentic features](https://v0.app/docs/agentic-features) | **partial** | 管线已有多 Agent；缺用户可控「工具自治度」 |
| v0 | Publish as **Template**；Analytics toggle | Quickstart Project Settings | **partial** | Community/Remix 已有；模板发布可增强 |
| **Bolt** | **Plan Mode**：不改代码讨论；首页可先 Plan；Inspector 点选讨论 | [Plan/Discussion Mode](https://support.bolt.new/best-practices/discussion-mode) | **yes** | 与蓝图互补 |
| Bolt | **Account / Project / Team Knowledge** 持久指令 | [Project settings](https://support.bolt.new/settings/project-settings)、prompting 文档 | **partial** | 重叠品牌记忆；Knowledge 是**可编辑指令面** |
| Bolt | **Standard vs Max** agent 选择（复杂度/推理） | [Agents](https://support.bolt.new/building/using-bolt/agents) | **yes** | Credits≠能力档 UX |
| Bolt | MCP、GitHub、Stripe、Expo、multiplayer | [Intro to Bolt](https://support.bolt.new/building/intro-bolt.md) | **partial** | 集成广度；实时共编非 Open-OX 当前定位 |
| **Replit** | **Plan Mode** → 任务列表 → **Start building** | [Plan Mode](https://docs.replit.com/references/agent/plan-mode) | **yes** | 与 BoardRun 不同：先批准计划再执行 |
| Replit | **Design Canvas**：多向 mockup、标注、设备框、与 live app 分离后再 Apply | [Canvas](https://docs.replit.com/learn/design/canvas) | **partial** | 气质分叉有；Canvas **流程板/分离实验**更强 |
| Replit | **Checkpoints**（代码+上下文+DB）+ 描述 + **单次成本** | [Checkpoints](https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks) | **partial** | 时光机有；**checkpoint 计价可见**净增 |
| Replit | Lite / Economy / Power / **Turbo** 模式 | [Agent overview](https://docs.replit.com/references/agent/overview.md) | **yes** | 努力档 × 成本 |
| Replit | Publish：**Security Scan** 阶段；**Feedback widget** → Inbox → Send to Agent | [Publish](https://docs.replit.com/build/publish-your-app)、[Enable Feedback](https://docs.replit.com/build/enable-feedback) | **yes** | 批注想法偏作者侧；这是**访客→Agent** |
| **Cursor** | **Plan Mode**：澄清问题 → 可编辑 plan → Build；可回 plan 重跑 | [Plan Mode](https://cursor.com/docs/agent/plan-mode) | **yes** | 可直接迁移到 builder |
| Cursor | **Cloud Agents**：隔离 VM、并行、多仓 PR | [Cloud Agents](https://cursor.com/docs/cloud-agent) | **partial** | Hermes cron/kanban 已谈；产品化「后台跑完开 PR」可参考 |
| **Framer** | Agent 在 **canvas 上生成可编页**；选 layer 再改；**branch → Apply to main** | [Framer Agents help](https://www.framer.com/help/articles/how-to-build-a-website-from-scratch-with-framer-agents/) | **partial** | 分支探索心智可学；输出是 Framer 非 Next.js |
| Framer | CMS/SEO/audit agents；**External agents**（Claude/Cursor 驱动站点） | [framer.com/ai](https://www.framer.com/ai/)、[External agents](https://www.framer.com/help/articles/use-external-agents-with-framer/) | **partial** | 飞书类似；MCP/CLI 反控可净增 |
| **Webflow** | AI site builder：**先出可改站点结构**再生成；Assistant 新 section **继承 classes/variables**；多方案 hover 选 | [AI site builder help](https://help.webflow.com/hc/en-us/articles/38840145286035-Build-a-site-with-Webflow-s-AI-site-builder)、[Modify designs](https://help.webflow.com/hc/en-us/articles/34205154436243-Modify-page-designs-with-the-Webflow-AI-Assistant) | **partial** | 蓝图有；**设计系统继承**净增 |
| **Relume** | **Sitemap ↔ wireframe 双向绑定**；section prompt；组件库变体；client comments（按设备） | [Wireframes doc](https://www.relume.io/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder)、[relume.io](https://www.relume.io/) | **partial** | 蓝图有；**IA↔线框联动 + 库组件**更具体 |
| **Softgen** | **Model selector**；Visual Editor **不耗 credits**；Plan Mode；Advanced Mode（terminal/cost） | [softgen.ai](https://softgen.ai/)、[Changelog](https://softgen.ai/changelog) | **partial** | 模型选择 / 免费视觉改 可参考 |
| **Dora** | Prompt→落地页；风格库；无模板宣称；3D/动画向 | [dora.run/ai](https://dora.run/ai)、[Using AI](https://help.dora.run/en/articles/9373711-using-ai-in-dora) | **no** | 与真实 Next.js 定位冲突；不建议照搬 |
| **Figma Make** | Attach frames；**point & edit**；**Make kits**（npm+指南）；Plan mode；模板/remix；协作同会话 | [Explore Make](https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make)、[figma.com/make](https://www.figma.com/make/) | **partial** | Kits/设计系统包 净增 |
| **Claude** | Artifacts 侧栏产物 + publish/remix；**Projects** 知识库 + 项目指令 | [Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)、[Projects](https://support.anthropic.com/en/articles/9517075-what-are-projects) | **partial** | Remix 已有；项目级知识指令可学 |

Gap 定义：**yes** = 产品面基本缺失；**partial** = 有部分能力或想法池已覆盖但形态弱；**no** = 不建议追或已足够。

---

## 3. 按体验旅程分组的新颖能力

### 3.1 进入 / 起稿

| 能力 | 竞品证据 | 为何重要 | Open-OX fit |
|------|----------|----------|-------------|
| **Plan Mode（先谈再写）** | Bolt Plan；Replit Plan→任务列表→Start building；Lovable Plan；Cursor Plan（澄清题+可编辑 plan）；Softgen Plan；Figma Make Plan | 降低「贵 token 赌一把」；与只读蓝图不同——是**对话式架构/任务批准门** | 蓝图 PRD 管 IA；Plan Mode 管「改什么/怎么改」；二者可组合 |
| **Sitemap↔线框联动 + section prompt** | Relume：sitemap 删 section 同步线框；标题/描述驱动组件生成 | 比纯文字纲要更可操作；客户签线框心智成熟 | 可把蓝图升级为「双栏 IA+线框」；勿做成假高保真站 |
| **结构确认后再渲染** | Webflow AI site builder：先 refine pages/sections，再生成 | 与蓝图同族；Webflow 明确「最多 5 页」边界 | 对齐已有蓝图；学「结构编辑器为一等公民」 |
| **设计方向 Canvas（与 live 分离）** | Replit Canvas：多版本并排、标注、设备框、Apply 才回写 app | 气质分叉已谈；Canvas 多支持**流程多屏 + 安全实验** | 生成前气质板可演进为轻量 Canvas；避免假成品截图坑（见 attraction 文档） |
| **从设计系统 / Kit 起步** | Figma Make kits（npm + styles + guidelines）；Webflow 继承 classes | 「像我的品牌」比再写 prompt 稳 | Design Intent / token 库 → 可产品化为「项目 Kit」 |

### 3.2 生成中信任

| 能力 | 竞品证据 | 为何重要 | Open-OX fit |
|------|----------|----------|-------------|
| **Agent 努力档可见** | Replit Lite/Economy/Power/Turbo；Bolt Standard/Max | 用户用「贵一点但更深」交易，而非黑盒烧 credits | Generate/Modify 旁选档；映射模型/步数，不改底层定位 |
| **模型选择器** | Softgen 12+ models | 进阶用户控制感 | 可选；默认 Auto，进阶暴露 |
| **Checkpoint 带成本说明** | Replit checkpoints 含 billing info | 「这一步花了多少」建立信任 | Modify history turn 旁显示本 turn credits |
| **发布前 Security Scan** | Replit Publish：Provision → **Security Scan** → Build… | 交付仪式感 + 安全感 | 可挂在 BYO Deploy / Publish Preview 前（轻量扫描即可） |

### 3.3 Studio 编辑

| 能力 | 竞品证据 | 为何重要 | Open-OX fit |
|------|----------|----------|-------------|
| **Pending 批改 → Apply 成版本** | v0 Design Mode：面板改动暂存；Undo/Redo/Reset；before/after 切换；Apply 生成新 chat version | 想法池有 Apply 后 Diff；缺 **Apply 前**暂存对比 | 在 Direct Apply 上加「暂存层」：多属性攒一批再写源码 |
| **Draw annotation → 改布局** | Lovable Draw（形状识别清理）；Replit Canvas 画标注 | 空间意图难用文字；比纯「意图条」更具体 | Design Mode 工具条增 Draw；送入 Modify 草稿 |
| **改动队列** | Lovable preview toolbar queue；Prompt queue（重排/暂停/重复） | 不等待也能连点小改；可控 | 与 BoardRun 并列：用户可见 **Modify 请求队列** |
| **免费小改 / 不计 credit 视觉改** | Lovable inline text 日限 100；Softgen Visual Editor 不耗 credits | 消灭「改个错别字也扣钱」怨气 | Design Mode Direct Apply 保持免费（已有）+ 文案配额叙事产品化 |
| **属性面板 × 自然语言同框** | v0 panel + instructions；Figma Make point & edit；Lovable 已从纯面板转向 toolbar+chat | Open-OX 已有 Direct Apply；缺「面板+NL 同次提交」 | 对齐意图条，并借鉴 v0「同元素先攒再 Apply」 |

### 3.4 协作 / 分享

| 能力 | 竞品证据 | 为何重要 | Open-OX fit |
|------|----------|----------|-------------|
| **预览内钉点评论（含未读）** | Lovable Add a comment；Relume 分享链接评论（可按设备） | 想法池有客户批注；竞品已产品化为预览工具条模式 | 优先做 Publish Preview 批注 → Modify 草稿 |
| **访客 Feedback → Send to Agent** | Replit Enable Feedback：元素选择/截图/附件 → Inbox → Agent | **上线后**闭环，非仅作者侧批注 | Deploy/Preview URL 可选反馈条 |
| **多会话共一工程 / Chat=分支** | v0 Projects + GitHub branch-per-chat | 团队/并行主题不互相踩 `main` | 长期：Studio「主题会话」= 分支；短期：Git 导出+PR 叙事 |
| **Artifacts/模板 remix** | Claude Artifacts publish/remix；v0 Template；Figma Make templates | Community Remix 已有 | 学「模板带指南约束」而非裸拷源码 |

### 3.5 交付与迭代

| 能力 | 竞品证据 | 为何重要 | Open-OX fit |
|------|----------|----------|-------------|
| **SEO/AI 搜索体检 + 一键修** | Lovable SEO & AI search（sitemap、robots、a11y、Lighthouse、GSC） | 想法池有体检；缺 SEO/GSC 产品面 | Publish Preview / Deploy 前挂 SEO 清单 |
| **流量洞察 → 再修改** | Lovable analytics tools；v0 Analytics 开关；Bolt analytics in project settings | 知道哪页跳出再让 Agent 改 | BYO Vercel Analytics 接入 Studio「建议改这里」 |
| **GitHub PR 作为交付单元** | v0 Open PR / Merge in product | 对「真实 Next.js 工程」定位最贴 | 导出/连接 GitHub 后默认 feature branch + PR |
| **External agent / MCP 反控** | Framer external agents；Lovable MCP | 在 Cursor/Claude 里改站 | 飞书之外：MCP「改 Open-OX 项目」 |
| **Workspace Skills** | Lovable reusable skills（launch checklist、a11y pass…） | 可复用工作流，非只聊天 | 用户/工作区级「改站剧本」 |

---

## 4. Open-OX 体验提升机会清单

以下均要求：**有竞品一手证据** + **想法池未完整覆盖（或形态显著不同）** + **可作产品方向**。

### P0（建议优先押注）

1. **Studio「Plan Mode」门** — 证据：Bolt / Replit / Lovable / Cursor / Softgen / Figma Make。用户可先澄清与出任务列表，**批准后再写码**；与蓝图（IA）正交。Overlap：蓝图 §2.1 管结构，不替代 Plan。
2. **Design Mode「暂存批改 → Apply 成 Modify history turn」** — 证据：v0 Design Mode（pending + before/after + Apply→version）。Overlap：§3.2 是 Apply **后** Diff；此处是 Apply **前**暂存信任。
3. **预览「Draw annotation」进 Modify** — 证据：Lovable Draw；Replit Canvas 标注。Overlap：§4.2 批注偏留言；此处是**空间改版输入**。
4. **用户可见的改动 / Prompt 队列（可重排、暂停）** — 证据：Lovable queue。Overlap：BoardRun 是宽改任务卡，不是连续小改队列。
5. **努力档选择（Fast / Balanced / Deep）映射成本** — 证据：Replit 模式；Bolt Standard/Max。Overlap：Credits 有，缺**档位 UX**。

### P1

6. **Account / Project Knowledge 可编辑指令页** — 证据：Bolt Knowledge 三层；Claude Projects instructions。Overlap：§6.1 品牌记忆偏「学到的」；Knowledge 是**显式 playbook**。
7. **Publish/Deploy 访客 Feedback → Inbox → Modify** — 证据：Replit Feedback widget。Overlap：§4.2 偏作者发只读链；此处是**线上访客闭环**。
8. **SEO & 可发现性 Review + 一键修入口** — 证据：Lovable SEO & AI search。Overlap：§4.1 上线体检；建议收窄为 SEO/OG/sitemap 产品面。
9. **蓝图升级：Sitemap↔模块线框双向 + section prompt** — 证据：Relume。Overlap：§2.1；升级形态而非新立项名。
10. **GitHub：会话/改动 = branch + 产品内 PR** — 证据：v0 GitHub。强化工程定位；与 BYO Vercel 互补。
11. **修改回合旁显示本 turn credits / checkpoint 成本** — 证据：Replit checkpoint billing。信任向。
12. **设计系统 Kit（tokens + 组件约定 + 指南）挂到生成/Modify** — 证据：Figma Make kits；Webflow class inheritance。

### P2

13. **多 Chat / 主题会话共一 Project 文件系统** — 证据：v0 Projects。协作成熟后再做。
14. **Workspace Skills（可复用改站剧本）** — 证据：Lovable Skills；Figma Make custom skills。
15. **MCP / External agent 反控 Open-OX 项目** — 证据：Framer、Lovable MCP。在飞书之外扩展。
16. **Security Scan / Security memory（若走向全栈 app）** — 证据：Lovable / Replit。当前营销站可后置。
17. **模型选择器（进阶）** — 证据：Softgen。默认 Auto 即可。

---

## 5. 明确不建议照搬

| 能力 | 为何不照搬 |
|------|------------|
| **纯 Framer/Webflow/Dora 画布宿主** | Open-OX 交付物是可导出 **Next.js 工程**；画布可作生成前预览，不能替代源码真相 |
| **浏览器内整仓 AST 乐观编辑为唯一写回**（早期 Lovable Visual Edits 工程路径） | Open-OX 已选 **服务端 source-coordinate Direct Apply + 验证**；学 UX 不学该写回架构（见既有 lovable-visual-edits 调研） |
| **把 Visual 属性面板做成唯一编辑器、弱化源码** | 与「真实工程 / Design Mode 写回」冲突；应保留双模 |
| **平台锁定托管 DB + 应用运行时作为默认成功标准**（Lovable Cloud 全家桶） | Open-OX 已有 BYO Vercel；可集成但不应用云锁定义「完成」 |
| **Dora 式「无代码 3D/动画站」主叙事** | 与 Next.js eng output 目标用户错位 |
| **静默黑盒记忆无可检视面** | 想法池已否决；Bolt/Claude 的可编辑 Knowledge/指令更安全 |
| **实时 multiplayer 共编同一预览为 P0** | Bolt 有；Open-OX 当前协作杠杆在 Remix / 批注 / 飞书，优先级更低 |
| **破坏式 truncate 历史当「回滚」** | Lovable 等偏向追加式 Revert；应对齐非破坏式（既有 history 调研） |

---

## 6. 一手来源清单

### Lovable

- https://docs.lovable.dev/features/preview-toolbar  
- https://docs.lovable.dev/changelog  
- https://docs.lovable.dev/integrations/cloud  
- https://docs.lovable.dev/integrations/lovable-mcp-server  
- https://docs.lovable.dev/features/publish  
- https://docs.lovable.dev/features/custom-domain  
- https://lovable.dev/blog/visual-edits  
- https://lovable.dev/blog/introducing-visual-edits  

### v0 / Vercel

- https://v0.app/docs/  
- https://v0.app/docs/design-mode  
- https://v0.app/docs/quickstart  
- https://v0.app/docs/projects  
- https://v0.app/docs/github  
- https://v0.app/docs/agentic-features  
- https://v0.app/docs/git-import  
- https://v0.app/docs/faqs  

### Bolt / StackBlitz

- https://support.bolt.new/building/using-bolt/agents  
- https://support.bolt.new/best-practices/discussion-mode  
- https://support.bolt.new/settings/project-settings  
- https://support.bolt.new/building/intro-bolt.md  
- https://support.bolt.new/best-practices/prompting-effectively  
- https://support.bolt.new/integrations/google-stitch  
- https://github.com/stackblitz/bolt.new/  

### Replit

- https://docs.replit.com/references/agent/overview.md  
- https://docs.replit.com/references/agent/plan-mode  
- https://docs.replit.com/learn/design/canvas  
- https://docs.replit.com/getting-started/quickstarts/design-with-canvas  
- https://docs.replit.com/core-concepts/agent/checkpoints-and-rollbacks  
- https://docs.replit.com/build/publish-your-app  
- https://docs.replit.com/build/enable-feedback  
- https://docs.replit.com/learn/projects-and-artifacts/replit-deployments  

### Cursor

- https://cursor.com/docs/agent/plan-mode  
- https://cursor.com/docs/cloud-agent  
- https://cursor.com/docs/cli/using  

### Framer

- https://www.framer.com/ai/  
- https://www.framer.com/agents/  
- https://www.framer.com/help/articles/how-to-build-a-website-from-scratch-with-framer-agents/  
- https://www.framer.com/help/articles/use-external-agents-with-framer/  

### Webflow

- https://webflow.com/ai-site-builder  
- https://webflow.com/updates/webflow-ai-assistant  
- https://help.webflow.com/hc/en-us/articles/38840145286035-Build-a-site-with-Webflow-s-AI-site-builder  
- https://help.webflow.com/hc/en-us/articles/34205154436243-Modify-page-designs-with-the-Webflow-AI-Assistant  
- https://help.webflow.com/hc/en-us/articles/33961195523603-Get-contextual-help-using-Webflow-with-the-Webflow-AI-Assistant  

### Relume / Softgen / Dora / Figma / Claude

- https://www.relume.io/  
- https://www.relume.io/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder  
- https://softgen.ai/  
- https://softgen.ai/changelog  
- https://academy.softgen.ai/introduction/welcome  
- https://softgen.mintlify.app/introduction/capabilities  
- https://dora.run/ai  
- https://help.dora.run/en/articles/9373711-using-ai-in-dora  
- https://help.figma.com/hc/en-us/articles/31304412302231-Explore-Figma-Make  
- https://help.figma.com/hc/en-us/articles/31722591905559-Figma-Make-FAQs  
- https://developers.figma.com/docs/code/intro-to-figma-make/  
- https://www.figma.com/make/  
- https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them  
- https://support.anthropic.com/en/articles/9517075-what-are-projects  
- https://www.anthropic.com/news/artifacts  

### Open-OX 内部对照

- [`CONTEXT.md`](../../CONTEXT.md)  
- [`docs/product/ux-expansion-ideas-20260710.md`](../product/ux-expansion-ideas-20260710.md)  
- [`docs/product/attraction-ideas-20260713.md`](../product/attraction-ideas-20260713.md)  
- [`docs/product/hermes-agent-ux-scenarios-20260714.md`](../product/hermes-agent-ux-scenarios-20260714.md)  
- `docs/research/lovable-*`、`ai-builder-credits-pricing-20260711.md`、`studio-visual-extensions-20260707.md`  

---

## 7. 结论（给产品）

竞品差异化已从「会生成」转向三类：**生成前批准门（Plan / Sitemap-wireframe）**、**Studio 内暂存与空间标注（pending Apply / draw / queue）**、**交付后闭环（访客反馈、SEO、PR、成本可见）**。Open-OX 在 Design Mode 源码写回与 Remix 上已有位置；最大净增空间是 **Plan Mode、Apply 前暂存、Draw→Modify、改动队列、努力档×成本**，而不是再堆一个通用 AI 聊天框。

**一手来源未证实（刻意未写入机会清单）**：Galileo / Banani 等缺乏足够第一方 docs 细节的具体交互；第三方「Replit Dynamic Intelligence」等表述未单独核验的扩展能力。
