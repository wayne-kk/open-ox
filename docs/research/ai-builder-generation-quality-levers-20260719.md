# 调研：主流 AI Website/App Builder 如何提升生成站的视觉与产品品质（2026-07-19）

**状态**：完成（仅第一方公开材料：官方 docs / help / changelog / 第一方 blog / 官方 GitHub；**未登录**各产品内部编辑器做黑盒逆向；**不**采第三方「内部 prompt 泄露」或 Reddit 传言）  
**日期**：2026-07-19  
**问题**：主流 AI website / app builders 用哪些**可核对的产品/工程杠杆**提升生成站点的**视觉与产品品质**（不只是「能 build 通过」）？

**范围**：Lovable、v0、Bolt.new、Replit Agent、Framer AI、Webflow AI、Google Stitch、Relume、21st.dev；辅以 Cursor（仅当有与「站点品质」相关的第一方文档）；Famous / Dora / Galileo（设计工具）仅在有清晰第一方品质主张时记入。

**方法约束**：

1. 每条主张尽量回到所属产品的官方页面；引用短事实短语 + URL。
2. 内部编排未知时，只报**可观察产品行为**与文档承诺，并标「未知」。
3. 与既有调研**引用并延伸**，不整篇复述：
   - [`lovable-vs-openox-design-system-prompt-20260712.md`](./lovable-vs-openox-design-system-prompt-20260712.md)
   - [`ai-builder-competitor-ux-features-20260714.md`](./ai-builder-competitor-ux-features-20260714.md)
   - [`ai-builder-chrome-shell-pipelines-20260715.md`](./ai-builder-chrome-shell-pipelines-20260715.md)
   - [`famous-ai-design-system-20260711.md`](./famous-ai-design-system-20260711.md)（Famous 营销站视觉观察，非生成品质管线）
   - [`studio-visual-extensions-20260707.md`](./studio-visual-extensions-20260707.md)
   - [`docs/product-iteration-outline.md`](../product-iteration-outline.md) 阶段 E（质量与可观测性）

---

## 1. 结论摘要（Verdict）

主流产品几乎不把「视觉品质」押在**单一更长的生成 prompt**上，而是把品质做成**多层人机闭环 + 约束底物**：

| 杠杆簇 | 一句话 | 代表性第一方证据 |
|--------|--------|------------------|
| **A. 生成前锁定视觉方向** | 先选方向/结构/主题，再付昂贵全量 build | Lovable Design guidance（三方向 / 策展问答）；Webflow 先 refine pages/sections 再 Generate design；Replit Canvas 多版本并排后 Apply |
| **B. 约束组件/ token 底物** | 用 shadcn / 真实组件库 / Flowkit，减少「从零发明 UI」 | v0 默认 shadcn + registry；Bolt Design systems「built from your actual components」；Webflow Flowkit + 新 section 继承 classes/variables |
| **C. 人机视觉改写回路** | 点选 / 面板 / 画标注 / 画布直接改，再写回源码或项目 | v0 Design Mode；Lovable Preview toolbar；Framer「everything stays editable on canvas」 |
| **D. 多变体生成 → 人类择优** | 并行出多稿，品质靠选择而非单次命中 | Lovable 三方向；Replit「Show me five versions」；21st AI「several drafts at once」；Webflow AI Assistant hover 多方案 |
| **E. Plan / 意图批准门** | 先澄清产品与结构，减少「能跑但做错产品」 | Lovable / Bolt / Replit Plan Mode；Relume sitemap↔wireframe |
| **F. 持久 Knowledge / DS / Skills** | 品牌与品味指令跨会话注入 | Lovable Knowledge + Enterprise DS adherence；Bolt Account/Project/Team Knowledge + DS；Google Stitch `DESIGN.md` |
| **G. 生成后质量闸门（超越 build）** | SEO / a11y / 浏览器 critique·自测 / 访客反馈 | Lovable SEO & AI search；v0 browser use「critique designs」；Replit App Testing；Framer audit agent；Replit Feedback → Agent |
| **H. 社区 Remix / 策展组件飞轮** | 高品质起点复制，而非每次从空白 prompt 赌 | Lovable remix/templates；21st marketplace「fight AI slop」+ Featured 审核；v0 Templates；Open-OX Community Remix（本仓库） |
| **I. Agent 努力档 / 专用工具** | 用更深推理或专用 agent 换复杂度任务品质 | Bolt Standard vs Max；v0 browser/terminal 自治度；Framer 多模型选择 |

**一句话**：竞品公开面的品质策略是 **「先让用户（或策展库）选定视觉/结构约束 → 在受控组件底物上生成 → 用视觉编辑与多变体择优快速纠偏 → 用 SEO/浏览器/反馈做交付后闸门」**。未见主流产品文档主张「靠大量未产品化的内部 hero recipe 文件自动注入」作为主品质路径。

---

## 2. Lever taxonomy（对照第一方材料）

### 2.1 Pre-generation：guided brief / vibes / templates / references

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| **三方向轻量预览后提交再 build** | 「Compare three rendered previews… before committing」；HTML+Tailwind 轻量预览；可 refine ≤6 次 | [Lovable Design guidance](https://docs.lovable.dev/features/design-guidance) |
| **策展字体/色板/布局问答 → design brief** | 提交后变成「named fonts, hex colors, layout approach」 | 同上 |
| **结构确认后再渲染** | 「generate a proposed site structure… refine… Once you're happy… click Generate design」；最多 5 页 | [Webflow AI site builder](https://help.webflow.com/hc/en-us/articles/38840145286035-Build-a-site-with-Webflow-s-AI-site-builder) |
| **主题整站切换** | Generate design 后可换 theme（colors, animations, typography, sections, images…） | 同上 |
| **设计 Canvas 与 live app 分离** | mockups「separate from your live app」；Apply 才回写 | [Replit Canvas](https://docs.replit.com/learn/design/canvas) |
| **Sitemap ↔ wireframe + section prompt** | sitemap 标题/描述「helps inform AI what component to generate」 | [Relume wireframes](https://www.relume.io/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder) |
| **参考图 / URL / Figma** | Lovable FAQ：截图作灵感；v0 browser 访问外部 URL；Stitch 可从 URL 抽 DS；Replit Figma import / MCP | Lovable FAQ；[v0 Agentic](https://v0.app/docs/agentic-features)；[Stitch blog](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/)；Replit Canvas FAQ |
| **模板整仓起步** | Design templates「copies the full codebase… including… styling」 | [Lovable Design templates](https://docs.lovable.dev/features/business/design-templates) |

### 2.2 Design system / tokens / themes

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| **默认 shadcn/Tailwind 友好栈** | v0：「uses Shadcn/ui as its default component system」；Lovable Knowledge 示例偏好 Tailwind + shadcn | [v0 Design systems](https://v0.app/docs/design-systems)；[Lovable Knowledge](https://docs.lovable.dev/features/knowledge) |
| **Design Systems 2.0 skill（源码/Figma/消费端 app）** | DS 存为 workspace skill：「adapter that tells v0 where your source lives… which components… tokens are safe」；starter app 审核后作为后续生成地基 | [v0 Design Systems 2.0](https://v0.app/docs/design-systems-2) |
| **Registry / 机器可读 DS** | v0 legacy registry「pass context from your design system to AI Models」；Lovable Enterprise `design-system.json` + rules + **adherence**（禁 raw color 等） | [v0 Design systems](https://v0.app/docs/design-systems)；[Lovable Design systems](https://docs.lovable.dev/features/design-systems) |
| **从真实组件编译 DS** | Bolt：「built from your actual components, not stand-in code」；预载 Chakra / MUI / Shadcn | [Bolt Design systems intro](https://support.bolt.new/building/design-system/introduction) |
| **站点级 style guide / Flowkit** | Webflow AI 站点生成 Style guide page + Flowkit CSS Framework | Webflow AI site builder help |
| **Agent-friendly `DESIGN.md`** | Stitch：从 URL 抽 DS；`DESIGN.md` 导入/导出设计规则 | [Google Stitch blog 2026-03-18](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/) |
| **哲学：少文档、多关键决策** | Lovable 博文：反对 over-documentation；「AI handles ~90%… users define the 10% that matter」 | [Reinventing Design Systems](https://lovable.dev/blog/2025-01-24-reinventing-design-systems) |

细节对照见既有 [`lovable-vs-openox-design-system-prompt-20260712.md`](./lovable-vs-openox-design-system-prompt-20260712.md)。

### 2.3 Component libraries / curated blocks / remix community

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| **社区组件作生成上下文** | 21st：「start from real, hand-crafted work」；「fight AI slop」；AI 可 attach marketplace components | [21st Welcome](https://help.21st.dev/index.md)；[21st AI Overview](https://help.21st.dev/ai/index.md) |
| **发布质量门槛 + Featured 审核** | Visual/a11y/theming/demos；Published ≠ Featured catalog | [21st Quality Guidelines](https://help.21st.dev/publishing/quality-guidelines.md) |
| **Relume 组件变体替换** |「edit panel… variants」；「replace a component but keep the same copy」 | Relume wireframes doc |
| **v0 / Lovable 模板发布** | v0 Project Settings → Template；Lovable curated + workspace templates | [v0 Projects](https://v0.app/docs/projects)；Lovable changelog / Design templates |
| **Prompt 层「按组件而非整页」** | Lovable：「Prompt by component, not page」；「buzzwords」驱动间距/阴影/圆角/色板 | [Prompting best practices](https://docs.lovable.dev/prompting/prompting-one) |

### 2.4 Human-in-the-loop：visual edits / select-to-edit / approval gates

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| **属性面板 + NL + pending Apply** | v0：Typography/Color/Layout…；Undo/Redo/Reset；before/after；Apply → 新 chat version | [v0 Design mode](https://v0.app/docs/design-mode) |
| **Preview toolbar：Select / inline text / Draw / Comment** | 取代旧 Visual edits；Draw 形状识别；改动能 queue | [Lovable Preview toolbar](https://docs.lovable.dev/features/preview-toolbar) |
| **画布原生可编** | Framer：agent 产物「stays editable」；选 layer 再改；branch → Apply to main | [Framer Agents help](https://www.framer.com/help/articles/how-to-build-a-website-from-scratch-with-framer-agents/)；[framer.com/ai](https://www.framer.com/ai/) |
| **Plan 批准后再 Build** | Plan「never modifies your code」；批准后「based strictly on the approved plan」 | [Lovable Plan mode](https://docs.lovable.dev/features/plan-mode)；[Replit Plan vs Build](https://docs.replit.com/learn/plan-vs-build-mode.md)；[Bolt Plan Mode](https://support.bolt.new/best-practices/discussion-mode) |
| **Inspector 点选讨论（不立刻写码）** | Bolt Plan：Inspector highlight component，discuss changes | Bolt Plan Mode |

Open-OX Design Mode（source-coordinate Direct Apply）见 `CONTEXT.md` 与既有 studio 调研——形态是**即时写回**，与 v0「pending 再 Apply」不同（见 UX 调研 2026-07-14）。

### 2.5 Multi-variant generation & pick

| 产品 | 行为 | 来源 |
|------|------|------|
| Lovable | 三 design directions；已有项目可「Three options for the hero」 | Design guidance |
| Replit | 「Show me five versions of this landing page」并排；多风格组合 | Canvas |
| 21st AI | 「generates several variations in parallel」；Sketch vs Code mode | [AI Overview](https://help.21st.dev/ai/index.md) |
| Webflow AI Assistant | 多 layout 方案 hover 预览后选一；Show more | [Modify designs with AI Assistant](https://help.webflow.com/hc/en-us/articles/34205154436243-Modify-page-designs-with-the-Webflow-AI-Assistant) |
| Google Stitch | 无限画布 diverge/converge；语音「three different menu options / color palettes」 | Stitch blog；[Stitch real-time updates](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/) |

### 2.6 Post-gen evaluation / preview quality / tests

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| **浏览器打开自建 app 并 critique** | 「open the apps it builds… critique designs… fix things proactively」；发截图 | [v0 Agentic features](https://v0.app/docs/agentic-features) |
| **浏览器 App Testing 自测自修** | Agent「navigating through your application like a real user」；UI/流程/集成/a11y；Economy/Power 可开 | [Replit App Testing](https://docs.replit.com/references/agent/app-testing) |
| **自动修运行时/依赖错误** | v0 automatic error fixing；Fix with v0（部署错误） | [v0 Agentic features](https://v0.app/docs/agentic-features) |
| **SEO / a11y / Lighthouse 体检 + 一键修** | sitemap、robots、semantic HTML、alt、canonical、a11y、mobile、performance | [Lovable Changelog — SEO and AI search](https://docs.lovable.dev/changelog) |
| **发布前 Security Scan** | Lovable Basic/Deep scan；Replit Publish 含 Security Scan 阶段（见 UX 调研） | Lovable changelog；既有 UX 调研引用 |
| **站点 audit agent** | Framer：「identify contrast issues, typos, missing alt text, SEO gaps, and inconsistent styles」 | [framer.com/ai](https://www.framer.com/ai/) |
| **访客 Feedback → Agent** | 选元素、截图、附件 → Inbox → Send to Agent | [Replit Enable Feedback](https://docs.replit.com/build/enable-feedback) |

**未知/弱证据**：多数产品**未公开**「生成后视觉评分模型」或「brief 对齐自动抽检」的内部指标——阶段 E 对标的是产品化闸门，不是公开的 eval 平台。

### 2.7 Memory / knowledge / brand kits

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| Workspace + Project Knowledge | 可含「Brand voice… Design guidelines」；≤10k chars；Skills on-demand vs Knowledge always-on | Lovable Knowledge |
| Account / Project / Team Knowledge | 「style expectations, terminology, constraints」 | [Bolt Project settings](https://support.bolt.new/settings/project-settings)；glossary / prompting docs（搜索摘要与页面一致） |
| Repo instruction files | Lovable 读 `AGENTS.md` / `CLAUDE.md` | Lovable Knowledge FAQ |
| Stitch DESIGN.md + URL extract | 跨工具导入设计规则 | Stitch blog |

### 2.8 Remix / community quality flywheel

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| Public remix | Lovable remix 独立副本；模板/社区 | Lovable Getting started / FAQ |
| 21st Marketplace + Featured | 策展抗 slop；质量指南强制 theming/a11y | 21st Welcome + Quality Guidelines |
| v0 Templates | Project Settings → publish as Template | v0 Projects / Quickstart |

### 2.9 Model / routing / specialized agents

| 机制 | 证据要点 | 来源 |
|------|----------|------|
| Standard vs Max | Max「thinks more… large codebases… open-ended tasks」 | [Bolt Agents](https://support.bolt.new/building/using-bolt/agents) |
| 终端权限档 Ask/Auto/Full | 用户控制自治度 | v0 Agentic |
| Framer 模型选择 | Sonnet 5 / Opus 4.7 / GPT 5.5 / Fable 5 / GPT 5.6 Sol·Terra·Luna；按创意深度、审计、CMS 批量任务切换 | [Choosing a model](https://www.framer.com/help/articles/choosing-a-model-in-the-framer-agent/)（2026-07-16） |
| Plan 不写码 / Build 写码 | 产品模式分叉，非内部 Chrome Agent | Lovable / Replit / Bolt |

Chrome vs page 所有权：主流公开叙事是**单 agent 全树**，见 [`ai-builder-chrome-shell-pipelines-20260715.md`](./ai-builder-chrome-shell-pipelines-20260715.md)。**不**把 chrome-first 架构本身当作竞品「视觉品质」主杠杆。

### 2.10 Other levers（第一方可见）

| 杠杆 | 证据 |
|------|------|
| **真实文案约束** | Lovable：「Design with real content」；禁 lorem 倾向 |
| **Buzzword 美学旋钮** | Lovable prompting：minimal / premium / cinematic 等影响排版间距阴影 |
| **Prompt 框架（产品/语境/约束）** | Vercel：「Product surface / Context of use / Constraints & taste」；实验显示缺 context → 非响应式、假搜索 | [How to prompt v0](https://vercel.com/blog/how-to-prompt-v0)（2025-12-15） |
| **语音实时改设计** | Stitch voice：实时 critique / 多 palette | Stitch blogs |
| **Workspace Skills（质量剧本）** | Lovable Skills：a11y review、SEO audit、QA pass 等可复用 playbook | Lovable changelog |

---

## 3. Per-product evidence table

图例：● = 第一方明确产品化；◐ = 部分/文档建议/企业档；○ = 未见或极弱；? = 内部未知。

| 产品 | Pre-gen 方向/结构 | DS / tokens | 组件库/模板 | 视觉 HITL | 多变体 | Plan 门 | Knowledge | 后置质量闸 | Remix 飞轮 | Agent 档/工具 |
|------|-------------------|-------------|-------------|-----------|--------|---------|-----------|------------|------------|---------------|
| **Lovable** | ● Design guidance | ● Knowledge；● Enterprise DS+adherence；◐ 默认 Tailwind/shadcn | ● Templates；◐ remix | ● Preview toolbar | ● 三方向 + section options | ● Plan/Build | ● WS+Project Knowledge；● Skills | ● SEO/AI search；● Security | ● Remix/templates | ◐ Plan≠努力档；MCP |
| **v0** | ◐ Prompt 框架博客；参考 URL/browser | ● shadcn + registry；DS 2.0 skill；Tailwind tokens | ● Templates；Open in v0 blocks | ● Design Mode pending Apply | ○ 未见官方多稿并排产品步 | ○ 无 Plan Mode 同名 | ◐ Project / design-system skill | ● Browser critique；● auto error fix | ● Templates | ● Browser/terminal/MCP；权限档 |
| **Bolt** | ◐ Plan 先搭 base structure；Inspector | ● Preload + Team custom DS | ◐ Preload DS cards | ◐ Inspector（讨论向） | ○ | ● Plan Mode | ● Account/Project/Team | ◐ Analytics；修错偏工程 | ○ 弱 | ● Standard/Max |
| **Replit Agent** | ● Canvas mockups；Plan 任务列表 | ○ 弱公开 | ◐ Figma import | ● Canvas 标注/设备框/Apply | ● 多版本并排 | ● Plan→Start building | ◐ `replit.md` 项目指令 | ● App Testing（浏览器自测）；Feedback；Publish Security Scan | ○ | ● Lite / Economy / Power / Turbo |
| **Framer Agents** | ◐ 结构化 prompt 建议 | ◐ 设计系统/styles；模型选择影响气质 | ● Templates marketplace | ● 画布全权可编 + branch | ○ | ○ | ◐ Skills `/`；Mentions | ● Audit agent（contrast/SEO/a11y） | ● Templates | ● 多模型（Sonnet / Opus / GPT / Fable 等） |
| **Webflow AI** | ● Structure refine → Generate design；Theme | ● Flowkit + Style guide；Assistant 继承 classes | ◐ section layouts | ● Designer 原生 + AI Assistant | ● 多 layout 方案选一 | ◐ 结构编辑即批准门 | ○ | ○（平台自身 SEO 工具另论） | ○ AI sites 限制 Libraries | ○ |
| **Google Stitch** | ● Infinite canvas vibe design | ● URL→DS；DESIGN.md | ◐ Skills/MCP 导出 | ● 实时流式 + 语音 steer | ● 多方向并行 | ○ | ● DESIGN.md 可移植 | ◐ 交互原型 Play | ○ | ● Design agent；MCP/Skills |
| **Relume** | ● Sitemap↔wireframe | ○（组件库视觉） | ● 变体/库组件 | ● 线框编辑 + client comments | ◐ 变体切换 | ◐ IA 批准门 | ○ | ○ | ○ | ○ |
| **21st.dev** | ◐ 参考图/组件 attach | ● Themes marketplace；CSS vars 指南 | ● Community + Featured 审核 | ◐ 多轮 refine | ● 并行多 drafts | ○ | ○ | ● Publishing quality gate | ● Marketplace 飞轮 | ● Sketch/Code；CLI/MCP |
| **Cursor** | ● Plan Mode（通用工程） | ○ 非建站专用 | ○ | ○ 非 preview Design Mode | ○ | ● Plan | ◐ Rules/AGENTS | ○ | ○ | ● Cloud Agents 等 |
| **Famous / Dora / Galileo AI** | Famous：仅营销站视觉观察（既有调研），**无**公开生成品质管线文档。Dora：help 超时/材料薄，不硬凑。Galileo（原设计工具）第一方建站文档已不明显；**勿与** observability 产品 Galileo（docs.galileo.ai）混淆。Google Stitch 为当前 Labs 设计→代码主线。 | | | | | | | | | |

---

## 4. Open-OX already has vs missing

对照本仓库管线与既有调研（非竞品声明）。不确定处标 **uncertain**。

| 杠杆 | Open-OX 现状 | 判断 |
|------|--------------|------|
| Pre-gen vibe / 方向 | Studio **气质三选一**（`generateVibeDirections` / `confirmedDesignDirectionMarkdown`）→ 可跳过 `infer_design_intent`；另有 Intent / blueprint | **有**（产品化 vibe fork）；非 Lovable 级「轻量 HTML 三方向全页预览」 |
| Design Intent + Style Reference + tokens | `infer_design_intent` → `generate_project_design_system` → `apply_project_design_tokens`；用户 `styleGuide`（`public/skills/*.md`） | **有**（偏厚文档，见 lovable-vs-openox 调研「部分 over-specified」） |
| Chrome / shell | chrome-first（ADR-0005）：Scaffold 真壳 → Page 填内容 → polish | **有**（工程一致性杠杆；竞品少公开对标） |
| Section / hero skills | `prompts/skills/section/hero/*.md` + `heroSkillSelection.ts` **存在**；全仓 **无**对 `heroSkillSelection` 的调用；`enableSkills` 写入日志但未驱动选 skill | **资产在、管线未接（unwired）** |
| Design Mode HITL | Source-coordinate **Direct Apply**（即时写回）；无 v0 式 pending before/after | **有**（形态不同） |
| Plan Mode | 蓝图/Intent 有；**无**聊天内 Plan↔Build 批准门（UX 调研已记 gap） | **缺 / partial** |
| Knowledge playbook UI | 无 Lovable/Bolt 式 Account/Project Knowledge 面；品牌工具有 `brandKitFromUrlTool` | **缺产品面**（工具级 partial） |
| 多变体并排择优 | vibe 三选一有；生成后「五版 landing」式 Canvas **无** | **partial → 缺后置多变体** |
| Community Remix | Publish Preview + Allow Remix（`CONTEXT.md`） | **有** |
| 后置品质闸门 | `run_build` + repair/refeed；Credits「previewable deliverable」；**无**公开 SEO/a11y/brief-alignment 产品闸（阶段 E 规划中） | **偏 build-only success**（相对竞品 SEO/browser critique） |
| Effort tiers | `effortTier` fast/balanced/deep 已在 generation payload | **有**（工程已备；UX 暴露度 uncertain） |
| 浏览器视觉 critique / App Testing | 未见对等 v0 browser use 或 Replit App Testing 产品步；封面截图仅用于卡片 | **缺** |

---

## 5. Implications for Open-OX（按证据排序）

### 5.1 对「先 rewire hero skills」假说的批评

**假说**：把 `prompts/skills/section/hero/*` 重新接入 Page Implement，是提升首次视觉品质的最短路径。

**竞品证据指向的优先级不同**：

1. **用户可见的视觉承诺点**（Lovable Design guidance、Webflow theme/structure、Replit Canvas、21st 多 drafts）被第一方反复写成「减少 revision / land closer on first build」——这是**产品面选择**，不是内部 recipe 文件。
2. **受控组件/DS 底物**（shadcn registry、Bolt「actual components」、Webflow class inheritance、21st marketplace）被写成「high-fidelity / on-brand / fight AI slop」的主因——品质来自**可复用真实 UI**，而非更长的单次 codegen 说明。
3. **生成后视觉 HITL**（v0 Design Mode、Lovable toolbar、Framer canvas）被定位为把「大体对」修到「品味对」的默认路径；Vercel 博客明确：逻辑用 prompt，视觉微调用 Design Mode。
4. **Hero skill 最接近的竞品类比**是 Relume **变体库**与 21st **可 attach 的社区组件**——二者都是**人类可浏览/可挑选**的策展块，并常有质量门槛（21st Featured）。Open-OX 当前 skill 文件是**对用户不可见的内部 recipe**，且编排未调用；即使 rewire，若无「可选/可预览/可拒绝」产品面，仍不像竞品主杠杆。

**结论**：Rewire hero skills **可以作为**「策展块底物」的工程切片（对齐 Relume/21st），但**不应**假设它是竞品公开品质策略的中心。证据更支持：**强化 vibe/结构选择的可感知预览 → 加强 Design Mode 纠偏（含 pending/draw）→ 交付后 SEO/视觉抽检 → 再谈 skill 库产品化**。若 rewire，应做成「可选 section recipe + 预览/替换」，而不是静默强制注入。

### 5.2 排序建议（接地竞品证据，不臆造内部）

| 优先级 | 建议 | 竞品锚点 | 与 Open-OX 缺口 |
|--------|------|----------|-----------------|
| **P0** | 把既有 **vibe 三选一**做成更接近 Lovable 的「轻量视觉预览 + 明确锁定再 generate」（可保留 skip） | Lovable Design guidance；Replit Canvas | 已有 vibe fork，缺「看见再锁」强度 |
| **P0** | Design Mode：**pending 批改 + before/after + 批量 Apply**；可选 Draw→Modify | v0 Design Mode；Lovable toolbar | Direct Apply 已有；缺暂存层（UX 调研 P0） |
| **P0** | 生成成功定义对齐阶段 E：**brief 冲突抽检 + 关键路径 smoke**，不只 `run_build` | Lovable SEO review；v0 browser critique；Replit App Testing；阶段 E | 今日偏 build-only |
| **P1** | **Plan Mode**（改站/生成前批准任务列表）与蓝图正交 | Lovable/Bolt/Replit Plan | 明确 gap |
| **P1** | **Project/Workspace Knowledge**（品牌色、禁区、文案语气）可编辑面 | Lovable/Bolt Knowledge | 缺 |
| **P1** | Community Remix 升级为「模板 + 简短 design brief/指南」而非裸拷 | Lovable templates；21st Featured；v0 Templates | Remix 有；指南弱 |
| **P2** | Section **多变体生成后择一**（hero/pricing） | Lovable section options；21st drafts；Webflow Assistant | 缺 |
| **P2** | Hero/section skills：**先产品化为可选 recipe/变体**，再接线；或对接外部策展（21st MCP 类） | Relume variants；21st | 文件在、未接线 |
| **P2** | Browser/visual critique 一轮（截图→修），或轻量 App Testing | v0 browser use；Replit App Testing | 缺 |
| **谨慎** | 继续加厚 Style Reference 禁令章节 | Lovable 反 over-documentation；既有 lovable-vs-openox | 可能负向 |

### 5.3 与阶段 E 的对齐

[`product-iteration-outline.md`](../product-iteration-outline.md) 阶段 E 目标「从 build 通过升级到对 brief 可用」与竞品 **SEO/a11y/browser critique·App Testing/访客反馈** 同向。建议把 E1–E3 明确标为**品质杠杆（非可选运维）**，并与 P0「成功定义」合并度量。

---

## 6. Sources appendix

### Lovable
- https://docs.lovable.dev/features/design-guidance  
- https://docs.lovable.dev/features/preview-toolbar  
- https://docs.lovable.dev/features/knowledge  
- https://docs.lovable.dev/features/design-systems  
- https://docs.lovable.dev/features/business/design-templates  
- https://docs.lovable.dev/features/plan-mode  
- https://docs.lovable.dev/prompting/prompting-one  
- https://docs.lovable.dev/changelog  
- https://lovable.dev/blog/2025-01-24-reinventing-design-systems  

### v0 / Vercel
- https://v0.app/docs/design-mode  
- https://v0.app/docs/design-systems  
- https://v0.app/docs/design-systems-2  
- https://v0.app/docs/agentic-features  
- https://v0.app/docs/projects  
- https://v0.app/docs/quickstart  
- https://vercel.com/blog/how-to-prompt-v0  
- https://vercel.com/blog/ai-powered-prototyping-with-design-systems  
- https://vercel.com/blog/working-with-figma-and-custom-design-systems-in-v0  

### Bolt
- https://support.bolt.new/best-practices/discussion-mode  
- https://support.bolt.new/building/using-bolt/agents  
- https://support.bolt.new/settings/project-settings  
- https://support.bolt.new/building/design-system/introduction  
- https://support.bolt.new/building/design-system/add-design-system  
- https://support.bolt.new/building/design-system/use-design-system  

### Replit
- https://docs.replit.com/learn/design/canvas  
- https://docs.replit.com/learn/plan-vs-build-mode.md  
- https://docs.replit.com/build/enable-feedback  
- https://docs.replit.com/references/agent/overview.md  
- https://docs.replit.com/references/agent/app-testing  
- https://docs.replit.com/features/project-setup/replit-dot-md  

### Framer / Webflow / Relume
- https://www.framer.com/ai/  
- https://www.framer.com/help/articles/how-to-build-a-website-from-scratch-with-framer-agents/  
- https://www.framer.com/help/articles/choosing-a-model-in-the-framer-agent/  
- https://help.webflow.com/hc/en-us/articles/38840145286035-Build-a-site-with-Webflow-s-AI-site-builder  
- https://help.webflow.com/hc/en-us/articles/34205154436243-Modify-page-designs-with-the-Webflow-AI-Assistant  
- https://www.relume.io/resources/docs/how-to-create-and-edit-wireframes-in-the-relume-site-builder  

### Google Stitch / 21st
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/  
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/  
- https://github.com/google-labs-code/stitch-skills  
- https://21st.dev/mcp  
- https://help.21st.dev/index.md  
- https://help.21st.dev/ai/index.md  
- https://help.21st.dev/publishing/quality-guidelines.md  

### Cursor（低优先级）
- https://cursor.com/docs/agent/plan-mode  

### Open-OX prior / baseline
- 本仓库：`CONTEXT.md`；`docs/product-iteration-outline.md` §阶段 E；`docs/adr/0005-chrome-first-generate-pipeline.md`  
- `ai/flows/generate_project/steps/heroSkillSelection.ts`（无调用方，2026-07-19 核对）  
- `lib/studio/generateVibeDirections.ts`；`lib/generation/types.ts`（`confirmedDesignDirectionMarkdown`）  
- 既有 research 链接见文首  

### Explicit non-sources
- 第三方「泄露 system prompt」、Reddit/Twitter 传言、SEO「Top 10 AI builders」合集——**未作证据**。  
- Galileo observability（docs.galileo.ai）与历史 Galileo 设计工具无关，**未纳入**建站品质杠杆。

---

## 7. 调研局限

1. 未登录各商业产品的最新实验功能；changelog 与 docs 可能滞后于 UI。  
2. 商业产品内部 multi-agent / 视觉 reward 模型**未公开**——不能声称其「真正」如何打分。  
3. Dora help、部分 Bolt/Replit 页面曾 fetch 超时；已用官方 `.md` / 既有调研交叉核对关键点。  
4. Famous 仅作营销视觉参考（既有调研），不代表 Famous 产品生成管线。
