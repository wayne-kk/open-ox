## 万圣节赛博朋克落地页生成架构说明

本文件从「AI + 模板代码生成流水线」视角，描述当前万圣节赛博朋克活动宣传页是如何从意图 → 设计系统 → Token 落地 → Section 生成 → 页面拼装的完整流程。

---

## 1. 顶层目标与角色分工

**目标**：  
把一句业务意图（“做一个万圣节赛博朋克活动宣传页”）拆解成：

- **设计系统文档**：`design-system.md`
- **样式实现**：`globals.css` + `tailwind.config.ts`
- **具体内容区块组件**：`HeroSection` / `FeaturesSection` / `TimelineSection` / `CtaSection` / `FooterSection` 等
- **页面骨架**：`app/layout.tsx` + `app/page.tsx`

**AI 角色划分（对应 3 个 skill）**：

- **Generate Design System**：生成整份 `design-system.md` 规范
- **Apply Design Tokens**：基于 `design-system.md` 更新 `globals.css` 与 `tailwind.config.ts`
- **Generate Section Component**：按设计系统生成单个 Section 组件 TSX

---

## 2. 数据与文件流向总览

从“生产线”视角看一遍从无到有：

### 2.1 输入：设计意图（prompt）

- 人类提供一句或一段需求描述（如“万圣节赛博朋克活动页” + 受众 + 核心信息）。
- 这会被传给 `landing.generate_design_system` skill。

### 2.2 阶段一：设计系统生成（Generate Design System）

- **工具**：`ai/skills/landing.generate_design_system/prompt.md`
- **职责**：引导模型输出一份结构固定的 Design System 文档。
- **输出**：完整 Markdown 文档，落地到 `sites/template/design-system.md`。
- **文档内容包含**：
  - 设计哲学、氛围、触感隐喻、视觉签名
  - Token（颜色、字体、Radius、阴影、动画等）
  - 组件规范（Button / Card / Input）
  - 布局策略、响应式策略、可访问性要求
  - 实现注意事项（如何映射到 Tailwind / CSS 变量）

### 2.3 阶段二：Token 落地（Apply Design Tokens）

- **工具**：`ai/skills/landing.apply_design_tokens/prompt.md`
- **输入**：
  - `design-system.md`
  - 当前项目的 `app/globals.css`
  - 当前项目的 `tailwind.config.ts`
- **输出**：一个 JSON 对象（注意是完整文件内容，而不是 diff）：

```json
{
  "globals_css": "/* 完整 updated globals.css 内容 */",
  "tailwind_config": "// 完整 updated tailwind.config.ts 内容"
}
```

- **核心规则（由 skill 约束）**：
  - 保留 `@tailwind base/components/utilities` 指令
  - 在 `@layer base` 下，把 `:root` 里的 shadcn 变量更新为设计系统配色：
    - `--background` / `--foreground` / `--primary` / `--card` / `--muted` / `--accent` / `--border` / `--ring` / `--destructive` 等
  - 把 `design-system.md` 中声明的所有 CSS 变量（如 `--shadow-glow-pink`、`--shadow-glow-blue`、`--shadow-glow-dual`、`--scanline-opacity`、`--ease-out-arcade` 等）加到 `:root`
  - 加入所有 `@keyframes`（`glow-pulse` / `glitch-jitter` / `rail-scan` 等）
  - 在 `@layer utilities` 后面定义自定义工具类（如 `.cyber-grid`、`.noise-scanlines` 等）
  - 在 `tailwind.config.ts` 中扩展：
    - `theme.extend.colors` 绑定到 CSS 变量或 hex
    - `theme.extend.fontFamily` 映射到设计系统字体
    - `theme.extend.boxShadow` / `theme.extend.keyframes` / `theme.extend.animation` 等

> 结果：Tailwind 与全局 CSS 完全反映 `design-system.md` 里定义的“赛博朋克设计 DNA”。

### 2.4 阶段三：单个 Section 生成（Generate Section Component）

- **工具**：`ai/skills/landing.generate_section/prompt.md`
- **输入**：
  - `design-system.md`
  - 目标 section 的语义/内容意图（例如 Hero / Features / Timeline / CTA / Footer）
- **输出**：**仅 TSX 源码**，不带 markdown，不带解释：
  - 框架：Next.js App Router
  - 样式：Tailwind + 设计系统里定义的类和变量
  - 图标：`lucide-react`
  - 类型：TypeScript
  - 导出：`export default function [FileName]() {}`
  - 只有用到 hooks 或浏览器事件时才加 `"use client"`
  - 所有内容硬编码（无 props），便于一键插入模板
- **视觉要求**：必须清晰体现 Design System 中的签名特征，例如：
  - 深黑紫背景 + 霓虹洋红 / 电蓝 / 荧光绿
  - Cyber grid + scanlines 背景
  - 双层描边 + glow
  - glitch 微交互

- **结果文件示例**：
  - `components/sections/HeroSection.tsx`
  - `components/sections/FeaturesSection.tsx`
  - `components/sections/TimelineSection.tsx`
  - `components/sections/CtaSection.tsx`
  - `components/sections/FooterSection.tsx`

### 2.5 阶段四：页面骨架与布局拼装

#### 2.5.1 全局布局：`app/layout.tsx`

- 引入 `./globals.css`（已由 Apply Design Tokens 注入设计系统变量与工具类）
- 提供基础字体（当前仍是 `Geist` / `Geist_Mono`，后续可对齐设计系统）
- 包裹所有页面的 `<html>` 与 `<body>` 结构

#### 2.5.2 首页页面：`app/page.tsx`

- 定义当前页面的 `metadata`（标题 + 描述）
- 最外层渲染固定的赛博背景 overlay：
  - `repeating-linear-gradient` + `var(--scanline-opacity)` 实现扫描线
  - 多个 `radial-gradient` 实现霓虹光晕
- 在 `<main>` 内按顺序组合 Section：
  - `HeroSection`
  - `FeaturesSection`
  - `TimelineSection`
  - `CtaSection`
  - `FooterSection`

### 2.6 阶段五：组件库与 UI 基础配置

- `sites/template/components.json`（shadcn 配置）：
  - 指定 `css: "app/globals.css"`，让 shadcn 组件遵循同一套 CSS 变量体系
  - `iconLibrary: "lucide"` 与 Section 生成 skill 保持一致
  - 配置别名：`@/components`、`@/components/ui`、`@/lib` 等

---

## 3. 设计系统与代码之间的映射关系

### 3.1 颜色映射

- `design-system.md` 定义的 Token（示例）：

```txt
background:       #07040F
foreground:       #F2ECFF
card:             #0D0820
muted:            #120B2B
accent:           #FF2BD6
accentSecondary:  #2D6BFF
accentTertiary:   #7CFF4D
border:           #2A1558
input:            #1A0F3B
ring:             #8B5CFF
destructive:      #FF3B4E
```

- 在样式层的表现：
  - `globals.css` 中的 `:root` 定义对应 CSS 变量（直接 hex 或 HSL）
  - `tailwind.config.ts` 通过 `theme.extend.colors` 把这些变量映射到语义色：
    - 例如 `background: "hsl(var(--background))"`、`accent: "hsl(var(--accent))"` 等
  - Section 组件里使用 `bg-background` / `text-foreground` / `border-border` / `text-accent` 等语义类，而不是硬编码颜色

### 3.2 字体映射

- `design-system.md` 中的要求：
  - **Headings**：`"Oxanium", system-ui, sans-serif`
  - **Body**：`"Inter", system-ui, sans-serif`
  - **Accent/Labels**：`"JetBrains Mono", ui-monospace, ...`
- 实现建议：
  - 使用 `next/font/google` 在 `layout.tsx` 或单独的字体文件中引入这三套字体
  - 将字体变量挂到 CSS 变量（如 `--font-heading` / `--font-body` / `--font-mono`）
  - 在 `tailwind.config.ts` 中 `theme.extend.fontFamily` 做映射，组件中只使用 `font-heading` / `font-body` / `font-mono`

> 当前模板仍然在 `layout.tsx` 中使用 `Geist` / `Geist_Mono`，这是和设计系统略有偏差的地方，后续可以做一次统一替换。

### 3.3 阴影与动画映射

- 设计系统中定义的阴影与动画：
  - `--shadow-panel` / `--shadow-panel-sm` / `--shadow-panel-lg`
  - `--shadow-glow-pink` / `--shadow-glow-blue` / `--shadow-glow-dual`
  - `@keyframes glow-pulse` / `@keyframes glitch-jitter` / `@keyframes rail-scan`
  - 时间函数 `--ease-out-arcade` / `--ease-glitch`
- 在 Tailwind 与组件中的用法（推荐）：
  - 在 `tailwind.config.ts` 中扩展：
    - `boxShadow: { panel: "var(--shadow-panel)", neon: "var(--shadow-glow-dual)", ... }`
    - `keyframes` 与 `animation` 对应上述动画
  - Section 组件中直接使用：
    - `shadow-panel` / `shadow-neon`
    - `animate-glitch-jitter` / `animate-rail-scan` 等类

---

## 4. 从“重新生成网站”视角的端到端流程

这一节给出一个更偏操作层面的视角：如果现在要“重新生成一套同类型网站”，流水线会怎么走。

1. **人类写业务意图**
   - 例如：“为 18–30 岁喜欢赛博朋克文化的用户做一页报名落地页，需要展示活动亮点、时间表、票种信息和报名 CTA。”

2. **调用 `landing.generate_design_system`**
   - 输入：上述意图 + 可能的一些约束（语种、品牌色等）
   - 输出：一份新的 `design-system.md`（结构与当前文件相同，但内容围绕新的意图）

3. **调用 `landing.apply_design_tokens`**
   - 输入：新的 `design-system.md` + 旧的 `globals.css` / `tailwind.config.ts`
   - 输出：JSON 内含两份**完整**新文件内容
   - 把返回的字符串写回对应文件，实现 Token 与工具类的更新

4. **针对每个 Section 调用 `landing.generate_section`**
   - 对 Hero / Features / Timeline / CTA / Footer 分别调用一次：
     - 传入新的 Design System（保证视觉统一）
     - 传入该区块新的文案与结构需求
   - 将输出的 TSX 源码分别写入：
     - `components/sections/HeroSection.tsx`
     - `components/sections/FeaturesSection.tsx`
     - `components/sections/TimelineSection.tsx`
     - `components/sections/CtaSection.tsx`
     - `components/sections/FooterSection.tsx`

5. **页面骨架接线**
   - `app/page.tsx` 保持结构不变，只是 import 的 Section 组件内容已经换成新生成的版本
   - `metadata` 根据新活动修改标题和描述

6. **布局与字体在 `app/layout.tsx` 中全局生效**
   - 如有需要，可同时更新 `layout.tsx` 的字体引入逻辑，使之与新设计系统中 fonts 一致

---

## 5. 批判性视角下的改进点

从架构和实现一致性的角度，目前有几个值得后续优化的点：

- **字体一致性**
  - 设计系统指定 Oxanium / Inter / JetBrains Mono，但 `layout.tsx` 使用的是 Geist 家族。
  - 建议后续统一到设计系统字体，避免“设计系统说 A，代码用 B”的割裂。

- **shadcn 配置绑定程度**
  - `components.json` 的 `tailwind.config` 字段目前为空字符串。
  - 如果希望自动生成的 shadcn 组件完美继承 Token，建议把 `tailwind.config.ts` 路径填上，并确保 extend 部分覆盖设计系统 Token。

- **服务器组件 vs 客户端组件边界**
  - `app/page.tsx` 已经是 server component（无 `"use client"`），这有利于 SEO 和首屏性能。
  - 单个 Section 如果需要复杂交互 / 动画，可在内部加 `"use client"`，保持良好边界和负载分布。

---

## 6. TL;DR（给后来者的超短总结）

- 这个模板不是纯手写 UI，而是**一条流水线**：  
  **意图 → Design System（`design-system.md`）→ Token & CSS/Tailwind 落地 → Section 组件生成 → `app/page.tsx` 组合。**
- 三个 AI skill 各司其职：定义规则、落地 Token、生成 Section。
- 想换一套活动，只要：重写意图 → 重新生成 Design System → 应用 Token → 重新生成各 Section，即可在同一架构下快速产出新落地页。
