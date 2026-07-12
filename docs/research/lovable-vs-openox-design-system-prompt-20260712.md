# 调研：Lovable vs Open-OX — generate-project 设计系统提示词（2026-07-12）

**状态**：完成（仅第一方公开材料 + Open-OX 仓库内 artifact；**不**推断 Lovable 未公开的系统 prompt）  
**日期**：2026-07-12  
**问题**：

1. Open-OX 的 `generateProjectDesignSystem` Style Reference 提示词，与 Lovable 在生成应用时处理设计系统 / 样式 / 视觉身份的方式，有哪些**可核对**的具体差异？
2. Open-OX 这套 prompt 是否 **over-designed / over-specified**？

**范围**：生成期视觉身份与 token 产物；不含 Visual Edits 写回管道细节（见 `lovable-visual-edits-localization-20260709.md`）。

**方法约束**：只采 docs.lovable.dev、lovable.dev/blog、changelog、官方链接的示例项目/仓库、以及可公开访问的 design-system demo。第三方「泄露的 Agent Prompt」**不作为证据**。Lovable **内部生成 system prompt 未官方公开**——下文只谈可观察产品行为与文档。

---

## 1. 结论摘要（Verdict）

| 维度 | Lovable（公开面） | Open-OX（本仓库） |
|------|-------------------|-------------------|
| **生成前视觉决策** | 产品层 **Design guidance**：三方向预览 / 策展字体·色板·布局问答 → 收成 **design brief**（具名字体、hex、布局）；或用户用 buzzword / 自写 brief 跳过 | 流水线步骤：`inferDesignIntent`（短蓝图）→ `generateProjectDesignSystem`（长篇 **Style Reference** Markdown）→ `applyProjectDesignTokens`（写 `globals.css`） |
| **「设计系统」产品名** | **Enterprise** 专用：独立 DS 项目 + `design-system.json` + `.lovable/rules/*.md` + 组件复制与 adherence | 每次生成都产出站点级 `design-system.md`，供后续 codegen 消费 |
| **默认可观察 token 形态** | 官方字体示例仓为 **shadcn 式** `--primary` / `--background` 等 **HSL 分量** + Tailwind v3 `@tailwind`；FAQ/MCP 写明默认栈含 Tailwind、常用 shadcn | Style Reference **禁止**以 shadcn 默认名作主命名，要求品牌语义名（如 `--color-parchment`），再在 apply 步 **映射**到 shadcn 兼容变量 |
| **Themes** | 曾推「colors / typography / spacing」工作区主题；changelog 已写 **从 Design view 移除**（低用量与性能） | 无对等产品面；主题即生成期 Style Reference + CSS |
| **哲学** | 博文明确反对传统「过度文档化」设计系统；主张 AI 扛 ~90% 决策、用户定关键点 | 提示词要求 **implementation-ready**、禁止无 CSS 映射的隐喻；偏「先写厚规范再生成」 |

**一句话**：Lovable 把「视觉身份」主要做成 **用户可选的轻量 brief / 策展选项 /（企业）机器可读 schema**，默认落地偏 **shadcn token + Tailwind**；Open-OX 把同一问题做成 **强制长篇 Style Reference + Tailwind v4 语义 token 与防碰撞硬规则**。Open-OX **部分 over-specified**：codegen 可靠性约束值得保留，但多处品味禁令、重复章节与下游几乎不消费的叙事块会膨胀输出。

---

## 2. 证据地图（Lovable 第一方）

| 表面 | URL | 与本题相关的事实 |
|------|-----|------------------|
| Design guidance | https://docs.lovable.dev/features/design-guidance | 三方向 HTML+Tailwind 轻量预览；或字体对 / 色板 / 布局策展问答；提交后变成含 **named fonts、hex、layout** 的 design brief；可跳过；模板/DS 连接时跳过 |
| Design systems（Enterprise） | https://docs.lovable.dev/features/design-systems | DS = 专用项目；发布生成 `design-system.json`、`rules/design-tokens.md` 等；token 从顶层 `index.css` / `tokens.css` / `tailwind.config` / theme 源发现；连接后复制组件 + rules，并做 adherence（禁 raw color 等） |
| Design templates | https://docs.lovable.dev/features/business/design-templates | 整仓复制（含 styles），与「持续指导」的 DS 不同 |
| Knowledge | https://docs.lovable.dev/features/knowledge | 自由文本可含 Design guidelines；示例偏好 Tailwind + **existing palette/spacing** + **shadcn/ui** |
| Custom fonts | https://docs.lovable.dev/tips-tricks/custom-fonts | 提示词指定 web-safe / Google Fonts；链到示例项目与 GitHub |
| Prompting best practices | https://docs.lovable.dev/prompting/prompting-one | 「先定设计」；**buzzwords** 驱动排版/间距/阴影/圆角/色板；组件级 prompting；示例可一句指定 Inter + 气质 |
| FAQ | https://docs.lovable.dev/introduction/faq | 新应用默认 TanStack Start（自 2026-05-13）；**Tailwind** 样式；旧栈 React+Vite |
| MCP docs | https://docs.lovable.dev/integrations/lovable-mcp-server | 未指定时默认 **React, Vite, Tailwind, shadcn/ui**（与 FAQ 新默认栈并存——文档层有演进痕迹） |
| Changelog | https://docs.lovable.dev/changelog | Design guidance 上线；**Themes removed** from Design view |
| Blog: Reinventing Design Systems | https://lovable.dev/blog/2025-01-24-reinventing-design-systems | 批评传统 over-documentation；「base UI kit + 动态组件」；用户定品牌色等关键点，AI 扛重复决策 |
| Blog: MCP / design power | https://lovable.dev/blog/mcp-servers | Themes：colors, typography, spacing（产品发布时） |
| Blog: One year | https://lovable.dev/blog/one-year-of-lovable | Design themes：色、字、间距 |
| DS demo（docs 示例） | https://design-system-demo.lovable.app/ | 可见 Colors / Spacing（scale100–1000）/ Typography 角色表；文案 “Built with Base Web” |
| 官方链出的字体示例仓 | https://github.com/viborc/adding-fonts-example | `src/index.css`：shadcn 典型 `--background: 0 0% 100%` 等 HSL + `@tailwind base/components/utilities` |

**明确缺口**：Lovable **没有**公开「生成时内部 Style Reference 模板」或 system prompt。不能声称其 agent 是否生成与 Open-OX 同构的 Markdown 文档。

---

## 3. Open-OX 对照基线（本仓库第一方）

| Artifact | 路径 | 角色 |
|----------|------|------|
| Design System 步骤提示词 | `ai/flows/generate_project/prompts/steps/generateProjectDesignSystem.md` | 产出完整 Style Reference Markdown |
| Design Intent | `…/prompts/steps/inferDesignIntent.md` | 上游短蓝图：Mood / Color Direction / Style / Keywords |
| Apply tokens | `…/prompts/steps/applyProjectDesignTokens.md` | 把 Style Reference → Tailwind v4 `globals.css` |
| 映射规则 | `…/prompts/rules/tailwindMappingGuide.md` | 组件作者如何用 token |
| 步骤实现 | `…/steps/generateProjectDesignSystem.ts` | 写入站点 `design-system.md` |
| 模板槽位 | `sites/template/app/globals.css` | 初始仍含 shadcn 槽 + `--color-primary` 等，由 apply 步覆盖 |
| 防碰撞 | `…/shared/sanitizeThemeSpacingTokens.ts` | 运行时把 `--spacing-xl` 等改名，保护 `max-w-xl` |

流水线（`runGenerateProject.ts`）：`infer_design_intent` → `generate_project_design_system`（`design-system.md`）→ `apply_project_design_tokens` → 后续 page/section agent 读 DS + CSS。

---

## 4. Side-by-side 对比

### 4.1 何时、如何「选定」视觉身份

| | Lovable | Open-OX |
|--|---------|---------|
| 触发 | 开放式视觉请求 → Design directions；或 Design questions；有明确品牌/URL/DS/模板则跳过 | **每次** generate-project（有 design intent 输入）都跑 DS 步骤 |
| 用户交互 | UI 选三方向 / 策展字体色布局；可 refine ≤6 次 | 主要靠用户原始描述 + 可选 Style Guide 字符串；无对等「三方向预览」产品步 |
| 中间产物 | docs 称 **design brief**（字体名、hex、布局） | **长篇 Style Reference**（多章节 + Quick Start CSS 块） |
| 证据 | design-guidance；Open-OX：`generateProjectDesignSystem.ts` + prompt 结构 | |

### 4.2 「设计系统」一词的含义

| | Lovable | Open-OX |
|--|---------|---------|
| 日常生成 | 文档**不**要求每个项目先写一本 Style Reference；靠 brief / knowledge / 默认 UI kit | `design-system.md` 是正式流水线产物与下游 SSoT |
| 企业 DS | 版本化 schema + 组件库 + adherence（禁 raw color、禁本地重复实现） | 无同构「跨项目 library attach」；单次站点生成 |
| 哲学 | 博文：少文档、多迭代；Linear 式「信任品味」 | 提示词：每个决策映射 CSS/Tailwind；模糊隐喻不可接受 |
| 证据 | design-systems；reinventing-design-systems 博文；Open-OX prompt「Global Prohibitions」+「Hard Rules」 | |

### 4.3 Token 命名与落地形态

| | Lovable（可观察） | Open-OX（规定） |
|--|-------------------|-----------------|
| 默认色名 | 字体示例仓：`--primary`、`--muted`、`--background`…（shadcn） | **禁止**以 shadcn 默认名作主命名方案；要 `--color-parchment` 类语义名；`--color-background` 仅可选兼容别名 |
| 颜色格式 | 示例仓：HSL **分量**（无 `hsl()` 包装在变量值里） | Style Reference：**hex**（或完整 gradient 字符串） |
| 间距 | DS demo：`scale100`…`scale1000`（数值阶）；知识示例说 follow existing spacing scale | **语义名 only**；严禁 `--spacing-xs/sm/md/lg/xl/2xl`（Tailwind v4 与 `max-w-*` 碰撞） |
| Tailwind 代际 | 字体示例仍为 **v3** `@tailwind`；DS docs 承认 Vite 消费者可能拉 Tailwind 3 与 4 冲突 | 全流程 **Tailwind v4** `@theme` + `var(--…)`，禁 `theme()` |
| 证据 | viborc `index.css`；design-system-demo；design-systems 已知限制；Open-OX generate + apply prompts | |

### 4.4 组件规格、Do's/Don'ts、品味规则

| | Lovable | Open-OX |
|--|---------|---------|
| 组件规格 | Enterprise：schema 出 catalog；日常：用户用 atomic prompt / 预览工具栏改 | Style Reference 强制 **6–12 named components**，含 hover/focus 等具体属性 |
| 反模式 | Knowledge「Things to avoid」自由写；adherence 扫 raw color | Global Prohibitions：禁纯白底、默认蓝 primary、泛用 sans+圆角卡+软阴影、clip-path/blob、grain 等 |
| 审美拨盘 | **Buzzwords**（minimal / cinematic / premium…）影响整页气质 | 固定禁令清单 + Similar Brands 锚定 + Do/Don't 各 5–7 条 |
| 证据 | prompting-one §7；knowledge；Open-OX `generateProjectDesignSystem.md` | |

### 4.5 字体

| | Lovable | Open-OX |
|--|---------|---------|
| 来源 | Google Fonts / web-safe（docs）；**不支持**直接上传自定义字体文件 | Hard Rules：**Google Fonts only** |
| 选型交互 | Design questions：策展 font pairs（heading+body）按 feel 分组 | Intent 步可推中文需 CJK Google Font；DS 步写完整 type scale 表 |
| 证据 | custom-fonts；design-guidance；Open-OX infer + generate Hard Rules | |

### 4.6 Themes / 事后改样式

| | Lovable | Open-OX |
|--|---------|---------|
| Themes 产品 | 发布过（色/字/间距，可跨项目）；changelog：**已从 Design view 移除** | 无 |
| 微调 | Preview toolbar：选中 + 自然语言 / 内联改字（见既有调研） | 依赖 modify / Design Mode 等本产品路径（本题不展开） |
| 证据 | changelog Removed；mcp-servers / one-year 博文（历史）；preview-toolbar docs | |

### 4.7 输出体积与下游消费

| | Lovable | Open-OX |
|--|---------|---------|
| Brief 厚度 | Design questions →「detailed design brief」；prompting 示例常为**短段落** | 模板含：Colors / Typography+Scale / Spacing / Radius / Shadows / Layout / Components / Do's Don'ts / Surfaces / Elevation / Imagery / Layout（再一次）/ Agent Prompt Guide / Gradient / Motion / Similar Brands / Quick Start CSS+`@theme` / Hard Rules |
| 代码侧 SSoT | 运行时 CSS/config +（企业）`design-system.json` | Markdown Style Reference **与** `globals.css` 双轨；apply 步明确吃 **Quick Start** 名 |

---

## 5. 问题 1：具体差异清单（可引用）

1. **决策 UX**：Lovable 用 **可视三方向 / 策展问答**（或跳过）；Open-OX 用 **无 UI 的两段 LLM**（intent → 厚 Style Reference）。  
   来源：design-guidance；`inferDesignIntent.md` + `generateProjectDesignSystem.md`。

2. **「Design system」产品化程度**：Lovable 的同名功能是 **Enterprise 跨项目 library + schema + adherence**；Open-OX 的同名产物是 **单次生成的站点 Style Reference**。  
   来源：design-systems；`generateProjectDesignSystem.ts` 写 `design-system.md`。

3. **Token 哲学**：Lovable 默认可观察路径贴近 **shadcn generic 名 + HSL**；Open-OX **强制品牌语义名 + hex**，再映射回 shadcn 槽。  
   来源：viborc `index.css`；Open-OX Global Prohibitions + apply「Keep shadcn/ui CSS variables mapped from…」。

4. **Spacing**：Lovable DS demo 用 **scaleN** 阶；Open-OX 因 Tailwind v4 把 `max-w-xl` 绑到 `--spacing-*`，**严禁** xs–2xl 键，并有 sanitize 兜底。  
   来源：design-system-demo；Open-OX generate/apply/sanitize。

5. **品味控制**：Lovable 公开教 **buzzword**；Open-OX 写死 **禁止纯白底 / 默认蓝 / 泛用卡片语言** 等。  
   来源：prompting-one；Open-OX Global Prohibitions。

6. **Themes**：Lovable 走过「工作区主题」又撤回；Open-OX 无对等，身份一次性写进生成物。  
   来源：changelog；mcp-servers 博文。

7. **文档哲学**：Lovable 官方博文批评传统 DS **over-documentation**；Open-OX 当前 prompt 刻意走 **厚、可实施文档**。  
   来源：reinventing-design-systems；Open-OX「implementation-ready Style Reference」。

8. **内部 prompt**：Lovable **未公开**生成期 system prompt → 不能对比「他们是否也有 Quick Start / Agent Prompt Guide」；只能对比产品契约与可观察文件。

---

## 6. 问题 2：Open-OX 是否 over-designed？

### 6.1 三分法

| 类别 | 内容（摘自 `generateProjectDesignSystem.md`） | 判定 |
|------|-----------------------------------------------|------|
| **(a)  codegen 可靠性** | 每 token 需 CSS 映射；Colors/Typography/Spacing/Radius/Shadow 表；**Quick Start** `:root` + `@theme` 镜像；Google Fonts；kebab `--` 变量；**spacing 禁 Tailwind 阶名**（与 apply + sanitize 一致）；display ≤60px / H1 ≤48px；输出仅 Markdown | **应保留**。这些直接服务 `applyProjectDesignTokens` 与 Tailwind v4 构建，且仓库已用测试/sanitize 证明碰撞是实害。 |
| **(b) 审美品味规则** | 禁 `#ffffff` 画布、禁默认蓝 primary、禁「sans + rounded card + soft shadow」、禁 grain/blob/clip-path 等 | **可选 / 宜瘦身或下沉到 intent**。这是产品品味策略，不是 Tailwind 正确性；Lovable 用 buzzword + 用户 brief，不把同类禁令公开成生成契约。过严会压掉合法品牌（医疗白底、银行蓝）。 |
| **(c) 冗余 / 膨胀** | **Layout** 出现在 Spacing 块内又独立一节；**Surfaces + Elevation** 与 Colors 重叠；**Agent Prompt Guide**（Quick Color + 3–5 copy-paste prompts）与 Components / Quick Start 三重说明；**Similar Brands**；冗长 Do's/Don'ts；Hard Rules 与文首 Global Prohibitions / Spacing 禁令 **重复** | **宜砍或合并**。下游 apply 步明确盯 Quick Start token 名；page agent 更吃 CSS utilities + 短规则。叙事块增加 token 成本与「写了但没人解析」的漂移面。 |

### 6.2 与 Lovable 对照后的判断

- **不是**「整份 prompt 都应扔掉」：Open-OX 无 Design guidance UI、无企业 DS schema、无事后 Themes，必须在生成期把身份钉死；**Quick Start + 语义 spacing + 禁模糊隐喻** 属于合理工程补偿。  
- **是**「相对 Lovable 公开契约偏厚、偏教条」：Lovable 把厚文档留给 **Enterprise DS 发布物**（`design-tokens.md` 等由 schema **渲染**），日常生成用 **短 brief + buzzword + shadcn 默认**；Open-OX 把「企业级文档厚度」压进 **每个项目的第一步**。  
- **重复成本**：同一 Tailwind v4 spacing 碰撞规则至少出现在 generate prompt、apply prompt、`tailwindMappingGuide.md`、`section.default.md`、以及 `sanitizeThemeSpacingTokens`——prompt 侧可只保留一处权威表述，其余引用或靠 sanitize。

### 6.3 Keep / Cut / Simplify（建议，非实施）

**Keep**

- 强制「可映射到 CSS/Tailwind」的输出契约  
- Colors / Type scale / Radius / Shadows 的结构化表  
- **Quick Start** CSS 块（apply 的契约面）  
- Spacing **语义命名** + 禁 `xs…2xl`（可缩短为一条 + 指向 sanitize）  
- Google Fonts-only（与当前栈一致时）

**Cut 或移出 generate 步**

- **Similar Brands**（审美锚，codegen 不解析）  
- **Agent Prompt Guide** 里的 Example Component Prompts（与 Components 重复；下游已有 section skills）  
- Global Prohibitions 中纯品味项 → 改到 `inferDesignIntent` 软偏好，或产品级「anti-slop」短清单（3 条内）

**Simplify / Merge**

- Surfaces + Elevation → 并入 Colors（标注 canvas / raised）  
- 两处 Layout → 一节  
- Do's/Don'ts → 各 ≤3 条，且必须引用已定义 token  
- Components：6–12 → **4–8**，只写站点真实会用的；细节以 token 引用而非复述 hex  
- Hard Rules：删掉已在前文出现的 spacing/输出格式重复句

**目标形态（对照 Lovable brief）**：接近「design-guidance 提交后的 brief 厚度」+「一份可粘贴的 `:root/@theme`」——而不是完整品牌手册。

---

## 7. 局限

- 未登录运行 Lovable 实机生成；未拆任意用户项目的私有 `index.css`（仅官方链出的示例仓 + docs 点名的 demo）。  
- FAQ（TanStack 默认）与 MCP 文案（Vite + shadcn 默认）有时间差；本文并列记录，不强行合成单一「当前默认文件树」。  
- 不使用第三方泄露的 Lovable Agent Prompt 文件。

---

## 8. Sources

1. https://docs.lovable.dev/features/design-guidance  
2. https://docs.lovable.dev/features/design-systems  
3. https://docs.lovable.dev/features/business/design-templates  
4. https://docs.lovable.dev/features/knowledge  
5. https://docs.lovable.dev/tips-tricks/custom-fonts  
6. https://docs.lovable.dev/prompting/prompting-one  
7. https://docs.lovable.dev/introduction/faq  
8. https://docs.lovable.dev/integrations/lovable-mcp-server  
9. https://docs.lovable.dev/changelog  
10. https://docs.lovable.dev/tips-tricks/best-practice  
11. https://lovable.dev/blog/2025-01-24-reinventing-design-systems  
12. https://lovable.dev/blog/mcp-servers  
13. https://lovable.dev/blog/one-year-of-lovable  
14. https://design-system-demo.lovable.app/  
15. https://github.com/viborc/adding-fonts-example （docs.lovable.dev/custom-fonts 官方外链）  
16. Open-OX：`ai/flows/generate_project/prompts/steps/generateProjectDesignSystem.md`  
17. Open-OX：`ai/flows/generate_project/prompts/steps/applyProjectDesignTokens.md`  
18. Open-OX：`ai/flows/generate_project/prompts/steps/inferDesignIntent.md`  
19. Open-OX：`ai/flows/generate_project/prompts/rules/tailwindMappingGuide.md`  
20. Open-OX：`ai/flows/generate_project/steps/generateProjectDesignSystem.ts`  
21. Open-OX：`ai/flows/generate_project/shared/sanitizeThemeSpacingTokens.ts`  
22. Open-OX：`sites/template/app/globals.css`  
