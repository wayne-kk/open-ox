# 调研：Lovable Visual Edits — DOM→源码定位与反写（2026-07-09）

**状态**：完成（基于第一方公开材料；实现细节以工程博文为准，产品 UX 以当前 docs 为准）  
**日期**：2026-07-09  
**问题**：Lovable 如何把预览 DOM 点选定位到源码，又如何把视觉编辑写回文件？Open-OX Design Mode 应学什么、刻意不抄什么？

**Open-OX 对照基线**：

- 架构：`docs/product/studio-design-mode-source-writeback-architecture.md`
- 代码：`lib/studio/designMode/directPatch/*`、`public/studio/design-mode-bridge.js`

---

## 1. 结论摘要

| 缝 | Lovable（2025 Visual Edits 工程博文） | Open-OX（当前 Design Mode） |
|----|--------------------------------------|------------------------------|
| **定位（localization）** | 编译期 Vite 插件给 JSX 打 **稳定 ID**；点选 DOM → 立刻映射到对应 JSX | 生成/回填 **`data-ox-id` 语义锚点**；bridge 上报 `oxId`；服务端 `rg` 找唯一文件 |
| **突变（mutation）** | **浏览器内整仓 AST**（Babel/SWC）声明式改 `className`/结构；再 codegen + diff 推云端 | **服务端**行级 Tailwind upsert / 文案字面量替换；无客户端 AST |
| **预览环** | 客户端乐观 Tailwind 生成 → Save → 云端 Vite HMR | Bridge live overlay → Apply → 写盘 → `hotRefreshDevServer` |
| **产品形态（2026）** | Preview toolbar **取代**旧 Visual Edits 面板；多数改动走 **选中 + 自然语言/聊天**；内联改文案仍可无 prompt | 仍走 Direct Patch（非 LLM）主路径；Modify 作复杂变更 fallback |

**一句话**：Lovable 的「精确视觉编辑」把 **源码图搬进浏览器**（稳定编译 ID + 客户端 AST + 乐观 Tailwind）；Open-OX 把 **语义锚点写进源码**，定位与突变都在 **服务端、确定性、可回滚验证**。当前 Lovable 产品文档已把「Figma 式属性面板」换成「预览工具栏 + 聊天」，工程博文描述的是被取代前的那套管道。

---

## 2. 产品演进：Visual Edits → Preview toolbar

### 2.1 2025 初：Visual Edits（无 prompt 的视觉面板）

产品公告（2025-02-12）描述：点 Edit → 选组件 → 直接改尺寸/颜色/文案；支持自定义 Tailwind；**无需与 AI 聊天**即可做精细调整。  
来源：https://lovable.dev/blog/introducing-visual-edits

工程博文（Lovable 站 2025-03-13；作者 Emil Ahlbäck 个人站 2025-03-04 镜像）描述同一功能的实现：稳定 JSX ID、客户端 AST、乐观 Tailwind、Save 后 HMR。  
来源：

- https://lovable.dev/blog/visual-edits
- https://www.emil.zip/blog/visual-edits （交叉核对：内容实质一致，个人站标题略不同、日期略早）

### 2.2 中间：Design view / AI-powered visual edits

Changelog 记载过：

- **Design view**：集中设计工具，含 Visual edits、Themes、AI 生图。  
- **All new Visual edits**：左栏编辑、混合内容文案、多选、页内改字、边距/阴影/图标等。  
- **AI-powered visual edits**：视觉编辑「全面 AI 化」，可覆盖动态/数据库内容；有日限额免费。  

来源：https://docs.lovable.dev/changelog

### 2.3 当前（docs）：Preview toolbar 正式取代 Visual edits

当前产品文档明确：

> The preview toolbar **replaces** the previous Visual edits experience. Instead of using a separate editing panel, choose a toolbar mode, point at what you want to change, and **describe the update in plain language**.

模式：

| 模式 | 行为 | 计费（docs） |
|------|------|--------------|
| Select elements | 点选（可多选）→ 附到聊天 → 自然语言改 | 标准 chat，耗 credits |
| Edit text inline | 页内改字 → Send | 每日 100 次免费/用户，超出耗 credits |
| Draw annotation | 在预览上画 → 附图 + 消息 | 标准 chat |
| Add a comment | 钉评论 | 评论免费；发给 Lovable 耗 credits |

来源：

- https://docs.lovable.dev/features/preview-toolbar
- https://docs.lovable.dev/glossary （「Preview toolbar … Replaces the older Visual edits panel」）
- https://docs.lovable.dev/changelog （Preview toolbar 条目）
- https://docs.lovable.dev/tips-tricks/best-practice （建议用 toolbar 做快速 UI 修复）

**对 Open-OX 的含义**：公开 docs **不再**描述「属性面板 + 客户端 AST 写回」的用户路径；Select 路径在产品层已回到 **元素引用 + LLM**。工程博文仍是理解 **定位/突变缝** 的最佳第一方材料，但 **不能** 假定当前产品仍对用户暴露完整的无 AI 样式面板。内联改文案是仍保留的「无 prompt 写回」子集。

**失效链接**：旧视频曾指向 `https://docs.lovable.dev/features/precision-edit`；2026-07-09 拉取为 **404**（已被 preview-toolbar 取代）。

---

## 3. 定位缝（DOM → 源码）

### 3.1 Lovable 声称的机制

1. **云端瞬时 Vite 开发服**  
   项目启动时在 fly.io 上起 ephemeral Node 环境（博文称持续托管 4k+ 实例），容器内有完整应用代码副本。  
   来源：https://lovable.dev/blog/visual-edits

2. **编译期稳定 JSX ID（自定义 Vite 插件）**  
   「at compile-time, each JSX component … receives a **unique, stable ID** through our **custom Vite plugin**. These stable IDs **persist across visual changes**.」  
   点选任意 DOM 元素时，「instantly **trace it back to the exact JSX**」。双向映射：Visual→code / Code→visual。  
   来源：https://lovable.dev/blog/visual-edits ；镜像 https://www.emil.zip/blog/visual-edits

3. **第一方 npm 包补证：`lovable-tagger`（定位实现更接近「源坐标」而非语义 ID）**  
   公开包 `lovable-tagger@1.3.1`（作者 Emil Fagerholm；导出 `componentTagger`）实现 Vite 插件，在 sandbox 模式下拦截 `react/jsx-dev-runtime`，用 React `jsxDEV` 自带的 `source`（`fileName` / `lineNumber` / `columnNumber`）给 DOM 节点打标：  
   - 运行时用 `Symbol.for("__jsxSource__")` 挂在节点上（**不是** README 里写的 `data-component-id`；当前 dist **无** `data-*` 注入）  
   - 键为 `` `${file}:${line}:${column}` ``，并维护 `window.sourceElementMap`（WeakRef）  
   - 宿主元素（`div` 等）与自定义组件渲染出口均可打标；SSR 时跳过  
   - 同包还导出 Tailwind config 抽取（写出 `tailwind.config.lov.json`），与博文「客户端读自定义 Tailwind」同向  

   **对博文「stable ID」的解读修正**：公开实现表明定位主键是 **JSX 源坐标（file:line:col）**，经 jsx-dev-runtime 绑定到 DOM；不是 Open-OX 式的语义 `hero-headline` 锚点，也不是服务端 ripgrep。README 仍写 `data-component-id`，与 dist 不符，以 dist 为准。  

   来源：`npm pack lovable-tagger@1.3.1` → `package/dist/index.js`（本地检视 2026-07-09）；registry https://www.npmjs.com/package/lovable-tagger

4. **仍未公开的细节（见 §8）**  
   博文/包仍未说明：客户端整仓 AST 同步协议、Save 时 diff 权威源、动态列表第 N 项稳定性、当前 Preview toolbar 是否仍走无 AI AST 写回。

### 3.2 Open-OX 当前机制

- 生成提示强制 / backfill 插入 **`data-ox-id`**（语义 slug，如 `hero-headline`）。  
- Bridge 向上找最近锚点 → `payload.oxId`。  
- 服务端 `rg` `data-ox-id="…"` → 唯一 TSX；再在锚点 JSX 块内找 `className`/文案。  
- 无锚点时 M0：文案/`classNameHint`/`selectorHint` 启发式；歧义则 **422，不猜**。  

来源：`docs/product/studio-design-mode-source-writeback-architecture.md`

### 3.3 对比

| | Lovable（博文 + `lovable-tagger`） | Open-OX |
|--|---------|---------|
| ID 来源 | Vite 插件 + **jsx-dev-runtime** 源信息 | 生成契约 + AST/行级 backfill |
| ID 语义 | **`file:line:col`**（Symbol / source map）；非语义 slug | 人可读 section-role；全项目唯一 |
| 解析发生地 | 点选时 O(1) 读节点上的源坐标 | 服务端 ripgrep + 行扫描 |
| 对构建链依赖 | **强**：需 dev JSX runtime / transform | **弱**：静态 HTML 代理也能靠注入的 `data-ox-id` |
| 覆盖面 | 理论上「任意 JSX」（dev 路径） | 可编辑节点契约；未锚点节点靠启发式 |
| Open-OX 近亲 | — | 已有未接线的 `data-ox-source`（file/line/col）instrumentation，更接近 Lovable |

---

## 4. 突变缝（源码如何被改）

### 4.1 Lovable：客户端 AST + codegen + diff 推送

博文明确：

1. **整仓代码同步进浏览器**，表示为 **AST**（Babel / SWC）。  
2. 用 AST **声明式**改源码（示例：`traverse` 找 `JSXElement` → 改 `className` 的 `StringLiteral` → `generate(ast).code`）。  
3. 明确反对纯 regex 改 JSX（嵌套、动态表达式会炸）。  
4. **Save 流水线**：  
   - 从修改后的 AST 生成合规 JSX/TSX  
   - **只 diff 改动行**  
   - 安全推到云端环境  
   - 触发 **Vite HMR**（无需整页刷新）  

来源：https://lovable.dev/blog/visual-edits ；https://www.emil.zip/blog/visual-edits

**与 LLM 的关系（工程博文时代）**：动机之一是小改动 **不经过 AI**，省成本、减幻觉。  
来源：同上。

**与当前产品**：Select elements 的变更「based on your description」且耗 chat credits —— 突变路径在产品层可能已 **重新引入 LLM**；docs **未**说明是否仍走客户端 AST 写回，还是仅把选中元素当 chat context。  
来源：https://docs.lovable.dev/features/preview-toolbar

### 4.2 Tailwind / 乐观预览

- 调 Tailwind class 时，由 **客户端 Tailwind generator** 乐观应用，并「intelligently reads **custom configurations**」。  
- **Save 前**即可看到与保存后一致的预览（AST 突变 + 即时 Tailwind 解析）。  

来源：https://lovable.dev/blog/visual-edits

产品公告亦强调自定义 Tailwind class。  
来源：https://lovable.dev/blog/introducing-visual-edits

### 4.3 Open-OX：服务端确定性 patch

- Style：computed → 有限属性 → Tailwind arbitrary upsert（`text-[#…]` 等）；冲突 token 族删除后 append。  
- Text：全文件 `before` 唯一性校验后字面量替换（锚点块内更安全）。  
- **不**解析动态 `className` 表达式；写后 prettier + tsc 诊断。  
- Live preview 是 bridge overlay，**不是**客户端 AST/Tailwind 编译。  

来源：`docs/product/studio-design-mode-source-writeback-architecture.md`

### 4.4 对比

| | Lovable（博文） | Open-OX |
|--|-----------------|---------|
| AST 位置 | **浏览器** | 无（服务端行/字符串级） |
| 突变表达力 | JSX 树级（示例为字面量 className） | 4 类样式 + 短文案 |
| 乐观预览 | 真 Tailwind 生成 | DOM overlay / 临时 style |
| 持久化 | AST → codegen → line diff → 云端 | 服务端写盘 → verify → hot refresh |
| AI | 博文：刻意绕开；当前 Select：走 chat | Direct Patch 绕开；复杂走 Modify |

---

## 5. 失败模式与未声称支持的能力

### 5.1 博文显式承认的难点

- 无 AST 的 regex 在嵌套组件、复杂 JSX、**动态表达式**上失败 —— 暗示即便有 AST，示例也只安全处理 **`StringLiteral` className**。  
  来源：https://lovable.dev/blog/visual-edits

### 5.2 博文未声称 / 未细化

- CSS Modules / CSS-in-JS / styled-components  
- `className={cn(...)}` / 条件 class 合并  
- 非 React / 非 Vite 栈  
- 服务端组件、流式 HTML、无客户端 hydration 的节点  
- 列表 `map` 中「第 N 项」与源码单一 JSX 的对应（稳定 ID 如何处理）  

### 5.3 Changelog 暗示的历史缺口（后被产品迭代）

- 「AI-powered visual edits … work across … **dynamic content from databases and APIs**」—— 暗示早期视觉编辑对动态内容覆盖不足。  
  来源：https://docs.lovable.dev/changelog  
- 「edit text in elements with **mixed content**」—— 暗示早期混合文本+图标难改。  
  来源：同上  

### 5.4 Open-OX 已文档化的失败阀

- 0/多文件命中、无 className、文案不唯一 → 422  
- 不支持动态 className / CSS-in-JS  

来源：Open-OX 架构文档（上引）

---

## 6. 次要参考：开源「JSX 源位置注入」（非 Lovable）

以下 **不是** Lovable 实现证明，仅说明业界常见的「编译期把 file:line 打进 DOM」模式，与 Lovable「stable ID + Vite plugin」叙述同族：

| 项目 | 注入形态 | 链接 |
|------|----------|------|
| `@builder.io/vite-plugin-jsx-loc` | `data-loc="path:line"` | https://www.npmjs.com/package/@builder.io/vite-plugin-jsx-loc |
| `babel-plugin-locate-source` | `data-at` / `data-filepath` / `data-line` 等；文档含 Next+Babel 路径（会关掉 SWC） | https://github.com/apperside/babel-plugin-locate-source |
| `vite-plugin-visual-edit` 等 | `data-source-location="file:line:col"` | https://github.com/Joinguyen/vite-plugin-visual-edit |

**用途**：若 Open-OX 评估「坐标式定位」，可用这些作为 **实现原型参考**，不要当作 Lovable 内部实现复述。

---

## 7. Open-OX 对照：若采用 Lovable 式架构要改什么

Open-OX 预览现实：**Next.js local preview** + **`site-previews` 静态 HTML 代理**（bridge 经 HTML inject / layout bootstrap）。见架构文档 §7。

### 7.1 定位缝选项（非决策）

| 选项 | 做法 | 适配 Open-OX | 代价 |
|------|------|--------------|------|
| **A. 保持 `data-ox-id`（现状）** | 语义锚点 + 服务端 rg | 两种 preview 后端都可用 | 覆盖依赖生成/backfill；非「任意 DOM」 |
| **B. 编译期坐标 ID（Lovable 同族）** | Next/webpack 或 Babel/SWC 插件注入 `data-loc` / 稳定 hash | **local `next dev` 可行**；**静态 site-previews 无 transform**，除非预构建时注入或放弃该后端 | 双后端分叉；Next 用 Babel 可能牺牲 SWC |
| **C. 混合** | 可编辑节点保留语义 `oxId`；调试/兜底用 compile-time loc | 渐进 | 两套 ID 协议 |

### 7.2 突变缝选项（非决策）

| 选项 | 做法 | 适配 Open-OX | 代价 |
|------|------|--------------|------|
| **A. 服务端行级 patch（现状）** | Tailwind upsert / 文案替换 + tsc | 与「preview 只采集、服务端写盘」原则一致 | 表达力有限；动态 class 失败 |
| **B. 服务端 AST（推荐若加深）** | 在 Node 用 Babel/SWC 按 `oxId` 或 loc 改 JSX | 不要求浏览器装整仓 AST；仍可验证 | 工程量大；需处理 prettier/格式 |
| **C. 客户端整仓 AST（Lovable 博文）** | 同步项目到浏览器、乐观 Tailwind、Save 推 diff | 与静态代理、安全边界、包体积冲突大 | 需安全沙箱、同步协议、自定义 Tailwind runtime；**最不像 Open-OX 现状** |

### 7.3 刻意不要照抄的点

1. **为抄 HMR 而强制 Vite 云端容器** —— Open-OX 已有 Next HMR / hot refresh；问题在定位与突变正确性，不在「有没有 fly.io Vite」。  
2. **把整仓 AST 放进浏览器** —— 安全、同步、双 preview 后端成本高；服务端 AST 更能保留「可验证写盘」。  
3. **把 Direct Patch 主路径改成「选中 + 聊天」** —— Lovable 产品演进说明那条 UX 更易扩展，但 Open-OX 已用 Direct Patch 解决「小改不烧 LLM」；可并存，不宜替换主路径而不评估成本。  
4. **假设「稳定 ID」自动解决动态列表** —— Lovable 也未公开该细节；Open-OX 语义锚点在「角色」层更稳，在「第 N 条数据」层同样难。

### 7.4 值得学的点

1. **编译期自动打标** 降低「生成忘写锚点」—— 可与 `data-ox-id` 并存（插件补漏，不替代语义 ID）。  
2. **AST 突变优于 regex** —— Open-OX 可把 `sourceMutator` 从行替换升级为 **服务端** JSX AST，仍保持「preview 不写盘」。  
3. **乐观预览尽量接近真实 Tailwind** —— 减少 Apply 后「看起来对、写盘后不对」。  
4. **Save 路径用精确 diff + HMR** —— 与现有 `hotRefreshDevServer` / scope 分类同向。  
5. **产品上区分「无 AI 精修」与「点选当 chat 上下文」** —— Lovable 两者都走过；Open-OX 可明确分层，避免混成一种交互。

---

## 8. 开放问题 / Lovable 未公开内容

1. ~~稳定 ID 编码~~ → **已由 `lovable-tagger` 补证为 `file:line:col` + Symbol**；是否另有生产路径 `data-*` 仍未知。  
2. 插件是否改磁盘源文件（tagger 只改 runtime，不改源）。  
3. 客户端 AST 的 **同步协议**（全量？按模块？与 GitHub 双向同步如何冲突解决？）。  
4. 乐观 Tailwind generator 如何读 **自定义 `tailwind.config`**（完整 JIT？预生成？tagger 只抽出 JSON）。  
5. Save 时 diff 的 **权威源**：浏览器 AST codegen vs 服务端 rebase。  
6. 当前 Preview toolbar 的 Select / inline text **是否仍使用** 博文中的 AST 写回管道，还是仅把元素引用交给 agent。  
7. 「AI-powered visual edits」与「preview toolbar replaces Visual edits」之后，**无 AI 的样式面板**是否完全下线。  
8. 对 **Next.js / RSC / 非 Vite** 项目是否提供同等定位（公开材料与 tagger 以 Vite + React jsxDEV 为中心）。

---

## 9. Architecture summary（Lovable）

```text
[Cloud Vite/dev container]
  Vite plugin (lovable-tagger): intercept jsx-dev-runtime
  → each host/custom JSX gets source { file, line, col } on DOM (Symbol)
       ↓
[Browser]
  click DOM → O(1) read file:line:col
  full project as client AST (Babel/SWC)  ← blog; not in tagger package
  edit → mutate AST + optimistic Tailwind preview
       ↓ Save
  codegen TSX → line diffs → push to container → Vite HMR
```

**产品层（2026 docs）**：同一预览上的 toolbar 更常把选中元素变成 **chat 上下文**；内联改文案仍是直接编辑子集。工程管道是否完整保留，公开材料未证实。

---

## 10. Implications for Open-OX Design Mode（选项，非终裁）

1. **短期**：继续 M2 `data-ox-id` + 服务端 patch；把失败模式（动态 className、混合节点）产品化提示，而不是假装有客户端 AST。  
2. **中期（高杠杆）**：突变缝升级为 **服务端 JSX AST**（按 `oxId` 定位节点），保留「iframe 只采集」；可选加强乐观预览（更接近真实 utility）。  
3. **可选**：在 **local Next preview** 加 compile-time loc 作兜底；**不要**假设 site-previews 静态代理能免费获得同一能力。  
4. **产品**：可借鉴 toolbar 的「点选 → 附到 Modify/chat」作 **复杂变更** 入口，与 Direct Patch **并存**，对齐 Lovable 演进而非倒退成「一切靠面板」或「一切靠 LLM」。  
5. **不要**：为对齐博文而引入浏览器整仓 AST + 强制 Vite 云端，除非预览基础设施先统一。

---

## 11. 主要来源

| 类型 | URL |
|------|-----|
| 工程博文（主） | https://lovable.dev/blog/visual-edits |
| 工程博文（作者镜像） | https://www.emil.zip/blog/visual-edits |
| 第一方定位插件（源码） | https://www.npmjs.com/package/lovable-tagger （检视 `dist/index.js`） |
| 产品发布 | https://lovable.dev/blog/introducing-visual-edits |
| 当前产品 docs | https://docs.lovable.dev/features/preview-toolbar |
| Glossary | https://docs.lovable.dev/glossary |
| Changelog | https://docs.lovable.dev/changelog |
| Best practices（toolbar） | https://docs.lovable.dev/tips-tricks/best-practice |
| Docs index | https://docs.lovable.dev/llms.txt |
| Open-OX 架构 | `docs/product/studio-design-mode-source-writeback-architecture.md` |
| 次要（开源 loc 插件） | §6 链接 |

---

## 12. Open questions / unknowns（清单复述）

见 **§8**。核心未知：ID 编码、插件是否改源文件、客户端 AST 同步、当前 toolbar 是否仍走无 AI AST 写回、动态列表稳定性。
