# 调研：Famous.ai 字体与色彩设计系统（2026-07-11）

**状态**：完成（第一方：live HTML/CSS、自托管 `@font-face`、Next.js 页面 chunk / SSR）  
**日期**：2026-07-11  
**问题**：Famous.ai 营销站用什么字体与色板？Open-OX（中英双语 AI 建站、当前 dark zinc）设计系统重设计应学什么、刻意不抄什么？

**范围**：Typography + color palette + visible design tokens。不含产品功能/定价经济学。

**方法**：只读 `https://famous.ai/`、`https://famous.ai/home2`、共享 CSS bundle、自托管字体 URL、以及对应 `_next/static` JS/SSR HTML。不依赖第三方评测/博客。

---

## 1. 结论摘要

| 缝 | Famous.ai（观察） | 对 Open-OX 的含义 |
|----|-------------------|-------------------|
| **Display 字体** | Clash Display（自托管 TTF，`font-weight: 600`）用于大标题/统计 | 可借鉴「display ≠ body」层级；**不要直接抄 Clash**（拉丁气质强，中英双语需 CJK 方案） |
| **Body 字体** | Plus Jakarta Sans 400/500/600/700（自托管 TTF）铺整页 | 可借鉴多字重 UI sans；Open-OX 已用 Instrument Sans，不必换成 Jakarta |
| **主色板（home2）** | 近黑 `#080811` / 深紫黑 `#0a0615` + 白字 + gray-300/400 副文 | 与 Open-OX zinc `#09090b` 同属深色产品；可加强「一层更深氛围色」 |
| **强调色（home2 实装）** | 白底黑字 pill CTA；紫/蓝/粉渐变描边与 glow | **抄白底高对比 CTA**；**避开紫→蓝→粉渐变 chrome**（Open-OX 已弃 cyber-neon） |
| **强调色（CSS 另存）** | `#b0ff08` 酸绿 + `#FF2D87` 品红出现在 stylesheet utilities | **刻意避免**——neon accent 正是 Open-OX 要远离的方向 |
| **Token 成熟度** | 仅少量 `:root` RGB 变量；大量 Tailwind arbitrary hex | Open-OX 应用命名 token（已有），不要学 Famous 的「hex 散落在 class」 |

**一句话**：Famous 的可学处是 **自托管 display/body 双字体 + 近黑底 + 白 pill CTA**；应避开的是 **紫粉蓝渐变描边、酸绿/品红霓虹、以及拉丁-only display 直接上中文站**。

---

## 2. 站点表面与来源地图

| 表面 | URL | 观察 |
|------|-----|------|
| 根首页（client） | https://famous.ai/ | HTML：`<html class="dark">`；空 `__next` 壳 + CSS `ea4ce8b464739906.css`；路由 chunk 挂载 `home.tsx`（`bg-gray-900`，标题 `from-orange-500 to-purple-600` 渐变字） |
| 营销改版页 | https://famous.ai/home2 | SSR HTML 含完整 Home2；`font-family: 'Clash Display'` / `'Plus Jakarta Sans'`；`bg-[#080811]` |
| 共享样式 | https://famous.ai/_next/static/css/ea4ce8b464739906.css | `@font-face`、`:root` tokens、Tailwind gray/purple/blue、arbitrary `#b0ff08` 等 |
| 字体文件 | https://famous.ai/home2/fonts/*.ttf | 自托管，`content-type: font/ttf`，Vercel 静态资源 |

说明：根路径 `/` 与 `/home2` **并存两套营销视觉**。自定义字体与近黑 canvas 的明确设计系统落在 **`/home2`**；`/` 仍为偏旧的 gray-900 + orange→purple 渐变标题。下文以 **home2 + 共享 CSS** 为主设计系统，并单独标注 `/` 差异。

来源：curl HTML of `/`（`class="dark"`、stylesheet href）；SSR of `/home2`（`data-sentry-component="Home2"`）；`_buildManifest.js` 路由表含 `/` 与 `/home2`；JS `pages/index-*.js` 非白标时渲染 `Home`（`home.tsx`）。

---

## 3. Typography

### 3.1 加载方式（非 Google Fonts / 非 next/font 公开链路）

共享 CSS 中的 `@font-face`（原文）：

```css
@font-face{font-family:Clash Display;src:url(/home2/fonts/Clash_Display_Variable_Bold.ttf) format("truetype");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:Plus Jakarta Sans;src:url(/home2/fonts/PlusJakartaSans-Regular.ttf) format("truetype");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:Plus Jakarta Sans;src:url(/home2/fonts/PlusJakartaSans-Medium.ttf) format("truetype");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:Plus Jakarta Sans;src:url(/home2/fonts/PlusJakartaSans-SemiBold.ttf) format("truetype");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:Plus Jakarta Sans;src:url(/home2/fonts/PlusJakartaSans-Bold.ttf) format("truetype");font-weight:700;font-style:normal;font-display:swap}
```

来源：`https://famous.ai/_next/static/css/ea4ce8b464739906.css`（`@font-face` 块）。

| 家族 | 文件 | 声明字重 | HTTP |
|------|------|----------|------|
| Clash Display | `/home2/fonts/Clash_Display_Variable_Bold.ttf` | 600 | 200, `font/ttf`, ~88KB |
| Plus Jakarta Sans | `PlusJakartaSans-Regular.ttf` | 400 | ~95KB |
| Plus Jakarta Sans | `PlusJakartaSans-Medium.ttf` | 500 | ~95KB |
| Plus Jakarta Sans | `PlusJakartaSans-SemiBold.ttf` | 600 | ~95KB |
| Plus Jakarta Sans | `PlusJakartaSans-Bold.ttf` | 700 | ~95KB |

来源：`curl -sI https://famous.ai/home2/fonts/<file>`（`content-type: font/ttf`，`content-length`）。

未观察到 Google Fonts / Adobe Fonts / `next/font` 的公开 stylesheet link；字体路径挂在 `/home2/fonts/`，与 marketing 改版同目录。

### 3.2 使用模式（home2 SSR + JS）

| 角色 | 家族 | 用法 | 证据 |
|------|------|------|------|
| **页面默认 / body** | Plus Jakarta Sans | 根容器 `style="font-family:'Plus Jakarta Sans', sans-serif"` + `bg-[#080811]` | SSR `/home2`；JS `home2.tsx` |
| **Display / 大标题** | Clash Display | Hero「Idea to app, instantly.」；统计 `$28M` / `4.5M` / `180k+`；各 section H2；CTA 大标题 | SSR inline `font-family:'Clash Display', sans-serif`（出现 ≥9 次于 home2 chunk） |
| **FAQ 问题 / CTA 按钮字** | Plus Jakarta Sans | FAQ `h3`、底部「Get Started」按钮显式 Jakarta | SSR `/home2` |
| **UI 字重** | Tailwind | 标题常 `font-bold`；按钮/标签 `font-medium` / `font-semibold`；FAQ 问题 `font-normal` | `home2-*.js` className |
| **Mono** | 系统栈 | CSS 仅有通用 `.font-mono{ui-monospace, SFMono-Regular, Menlo, …}`；home2 营销主路径未见产品级 mono 品牌字体 | 共享 CSS |
| **Serif** | 系统栈 | `.font-serif`；Social proof 中「Forbes」用 `font-serif` 作品牌仿写，非站点正文字体 | `home2-*.js` SocialProofSection |

Hero 排版细节（home2）：

- `text-4xl … lg:text-7xl font-bold text-white … leading-[1.1] tracking-tight` + Clash Display  
  来源：`HeroSection` in `pages/home2-*.js` / SSR HTML。

### 3.3 根首页 `/`（旧 Home）字体差异

- 页面壳：`className:"bg-gray-900"`（`home.tsx`）。
- Hero 标题：`font-extrabold` + `bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600`，**无** Clash/Jakarta inline。
- 回退栈：`html{font-family:ui-sans-serif,system-ui,sans-serif,…}`（共享 CSS），即系统 UI sans。

来源：`static/chunks/401-*.js`（Hero 标题 class）；共享 CSS `html{…font-family:ui-sans-serif…}`。

---

## 4. Color palette

### 4.1 CSS 自定义属性（可见 tokens）

```css
:root{
  --foreground-rgb:255,255,255;
  --background-start-rgb:17,24,39;
  --background-end-rgb:17,24,39;
}
html{scroll-behavior:smooth;color-scheme:dark}
body{
  color:rgb(var(--foreground-rgb));
  background:linear-gradient(to bottom,transparent,rgb(var(--background-end-rgb))) rgb(var(--background-start-rgb));
}
```

换算：`--background-*` → **#111827**（Tailwind gray-900）；`--foreground` → **#ffffff**。

另有 safe-area：`--sat/--sar/--sab/--sal: env(safe-area-inset-*)`。

来源：共享 CSS `:root` / `body` / `html` 规则。

**没有**完整 shadcn 式 `--primary` / `--muted` / `--border` 设计 token 层；品牌色大量以 Tailwind 工具类与 arbitrary hex 出现。

### 4.2 home2 实装画布与文字

| 角色 | 值 | 观察位置 |
|------|-----|----------|
| 页面底 | `#080811` | `min-h-screen bg-[#080811]`（Home2 根） |
| Hero / CTA 氛围底 | `#0a0615` | `bg-[#0a0615]`（HeroSection、CallToActionSection） |
| 纯黑区块 | `bg-black` | Social proof、Testimonials、部分遮罩 |
| 主文字 | `text-white` | 标题 |
| 次文字 | `text-gray-300` / `text-gray-400` / `text-white/80` | 副文、FAQ 答案、CTA 副句 |
| 更弱文字 | `text-gray-500` | Footer 版权、辅助 |
| 表面 | `bg-gray-900` / `bg-gray-900/80` / `bg-gray-900/90` + `backdrop-blur-*` | Prompt、feature 玻璃卡、FAQ |
| 边框 | `border-gray-700/30`–`/60`、`border-gray-800/50`、`border-white/20` | 卡、header、FAQ |
| Header | `bg-black/20 backdrop-blur-md` | 顶栏 |

来源：SSR `/home2`；`pages/home2-*.js` className / style。

### 4.3 home2 强调与渐变（实装）

| 角色 | 值 / 模式 | 观察 |
|------|-----------|------|
| 主 CTA | `bg-white text-black`（hover `bg-gray-100`），`rounded-full` | Header「Get Started」、多处 CTA——**高对比白按钮，非彩色霓虹** |
| 选中态 / 链接强调 | `purple-400` / `purple-600/20` + border `purple-600/30` | Prompt 平台切换（Web/Mobile/Crypto） |
| 装饰渐变描边 | `from-purple-600/40…60` → `to-blue-600/40…60`（常夹 `via-pink-600`） | Prompt 外框、feature 卡 `p-[1px]` 渐变边 |
| 氛围 glow | `bg-purple-600/20 rounded-full blur-[100px]`–`blur-[120px]` | Hero / CTA 中心光斑 |
| 标题渐变字（testimonials） | `from-purple-500 to-blue-500` + `bg-clip-text text-transparent` | 「on Trustpilot」 |
| Live 状态 | `bg-green-400` / `text-green-400` + `animate-pulse` | Community live feed |
| Check 图标 | `text-green-400` | Features 列表 |

来源：`pages/home2-*.js`（`from-purple` / `to-blue` 各约 14 次；`purple-600` 约 22 次）。

### 4.4 共享 CSS 中的「第二套」品牌 arbitrary 色（未在已下载 marketing JS 中命中）

这些工具类存在于同一 CSS bundle，说明源码某处曾用或仍用；**在已检查的 home / home2 / pricing / dashboard 主 chunk 中未找到字符串引用**。作为「stylesheet 中可见的品牌色库存」记录：

| Token-like hex | RGB | 出现的 utility 类型 |
|----------------|-----|---------------------|
| `#b0ff08` | `rgb(176, 255, 8)` | `bg` / `text` / `border` / `accent` / `shadow` / `ring`（含 `/10`–`/60` 透明度） |
| `#9ee608` | `rgb(158, 230, 8)` | `hover:bg-[#9ee608]` |
| `#7fb805` | `rgb(127, 184, 5)` | `border-[#7fb805]` |
| `#5e8a03` | — | 立体按钮 shadow：`0 2px 0 #5e8a03` |
| `#DBFE54` | `rgb(219, 254, 84)` | `text-[#DBFE54]` |
| `#FF2D87` | `rgb(255, 45, 135)` | `bg` / `text` / `border` / `shadow` |
| `#1a1a2e` | `rgb(26, 26, 46)` | `bg-[#1a1a2e]/60`、hover `/80` |
| `#111418` | `rgb(17, 20, 24)` | `bg-[#111418]` |

另有渐变片段：`radial-gradient(125% 55% at 50% 0, rgba(184,255,8,.06)`（酸绿顶光）；`linear-gradient(90deg,#2563eb,#3b82f6,#60a5fa,#3b82f6,#2563eb)`（蓝条）。

来源：共享 CSS 中 `.bg-\[\#b0ff08\]` 等选择器；hex 频次统计中 `#b0ff08` 出现 17 次（非 `#0000` 透明后最高品牌色之一）。

### 4.5 根首页 `/` 色板差异（旧 Home）

- 画布：`bg-gray-900`（≈ `#111827`，与 `:root` background RGB 一致）。
- Hero 标题：**orange-500 → purple-600** 渐变字（非白字 Clash）。
- 大量 `gray-800` 表面、`purple-400` hover、radial 背景装饰。

来源：`home.tsx` / Hero chunk className。

### 4.6 Tailwind 中性阶（营销常用子集）

从共享 CSS 工具类（与 Tailwind 默认 gray 一致）：

| Step | Hex（典型） | 角色 |
|------|-------------|------|
| gray-50 | `#f9fafb` | 浅色表面（少用） |
| gray-300 | `#d1d5db` | 次要正文 |
| gray-400 | `#9ca3af` | 说明文 |
| gray-500 | `#6b7280` | 更弱文案 |
| gray-600–700 | `#4b5563` / `#374151` | 边框/控件 |
| gray-800 | `#1f2937` | 浮层 |
| gray-900 | `#111827` | 默认深底 / `:root` bg |

来源：共享 CSS `.bg-gray-*` / `.text-gray-*` / `.border-gray-*` 声明。

---

## 5. Aesthetic language（2–3 句）

Famous.ai 整体是 **强制 dark（`color-scheme:dark` + `<html class="dark">`）** 的 AI 建站营销站：近黑/深紫黑全幅画布，中心大光斑与玻璃拟态卡片，密度中等偏营销（长 FAQ、滚动 testimonials、live feed）。动效以 **infinite marquee（`animate-scroll-left/right`）、pulse live 点、float/fadeIn/slideUp、渐变边框 shimmer** 为主，营造「实时建造」氛围。构图上 **prompt 输入是首屏锚点**，白 pill CTA 做转化，但大量 **purple/blue/pink 渐变描边与 glow** 使其视觉语言贴近常见 AI SaaS 模板。

---

## 6. Open-OX：应抄 vs 应避

对照 Open-OX 现状（`app/globals.css`：`--background: #09090b`；`app/layout.tsx`：`Instrument_Sans` + `JetBrains_Mono` via `next/font/google`；注释写明已弃 neon）。

### 应刻意借鉴

1. **Display / body 分工**：大标题与关键数字用更有性格的 display；UI/段落用 humanist sans 多字重（400–700）。Open-OX 可保留 Instrument 作 body，另选 **支持中文** 的 display，或 display 仅用于拉丁/数字。
2. **近黑分层**：`#080811` 页面底 + `#0a0615` 氛围层，比单层 flat zinc 更有深度——可用 token 表达「canvas / atmosphere」，不必抄紫调。
3. **白底黑字主 CTA**：home2 主转化是高对比白 pill，不是彩色 glow 按钮——与 Open-OX「one light primary」方向一致。
4. **自托管或 next/font + `font-display: swap`**：明确字重文件，避免运行时依赖未知 CDN。
5. **Prompt-first 首屏**：品牌 + 一句 headline + 输入 CTA 居中，符合「hero budget」。

### 应刻意避免

1. **紫→蓝→粉渐变描边 / blur glow / orange→purple 标题字**：典型 AI 模板；Open-OX 刚从 cyber-neon 收回 zinc，不应回流。
2. **酸绿 `#b0ff08` / 品红 `#FF2D87` 霓虹库存**：即使 Famous CSS 里有，也与 Open-OX 产品方向冲突。
3. **直接采用 Clash Display 作为中文站 display**：观察仅为拉丁 `@font-face`；中文会回退系统字体，中英混排易「标题西文、正文中文」割裂。
4. **hex 散落在 arbitrary class、几乎无语义 token**：Open-OX 应继续用命名 CSS 变量，不要学 Famous 的 `#b0ff08` 工具类堆法。
5. **营销噪音**：多行 testimonial marquee、emoji 装饰、多色 feature 卡边——产品站保持安静 zinc。

---

## 7. 与 Open-OX 当前 token 对照（速查）

| | Famous home2 | Open-OX（2026-07） |
|--|--------------|-------------------|
| 背景 | `#080811` / `#0a0615` | `#09090b` (`--background`) |
| 前景 | `#fff` + gray-300/400 | `#fafafa` (`--foreground`) |
| 主 CTA | 白底黑字 | `--primary: #f4f4f5` on dark |
| Display | Clash Display 600 | Instrument Sans（heading=同族） |
| Body | Plus Jakarta Sans | Instrument Sans |
| Mono | 系统 ui-monospace | JetBrains Mono |
| Accent 风险 | 紫粉蓝渐变 + CSS 内酸绿/品红 | 有意无 neon（globals 注释） |

来源：本文 §3–4；Open-OX `app/globals.css` `:root`、`app/layout.tsx` `next/font/google`。

---

## 8. 来源清单

1. https://famous.ai/ — HTML shell、`class="dark"`、CSS/chunk 引用  
2. https://famous.ai/home2 — SSR 字体 inline、色值 class、组件结构  
3. https://famous.ai/_next/static/css/ea4ce8b464739906.css — `@font-face`、`:root`、调色板 utilities、keyframes  
4. https://famous.ai/home2/fonts/Clash_Display_Variable_Bold.ttf 及 PlusJakartaSans-*.ttf — 自托管字体确认  
5. https://famous.ai/_next/static/wtFsIySii-kH5yyOujC7d/_buildManifest.js — `/` vs `/home2` 路由  
6. `_next/static/chunks/pages/home2-*.js`、`pages/index-*.js`、`401-*.js`、`3449-*.js` — 字体/颜色 class 与双首页差异  
7. Open-OX 对照：`app/globals.css`、`app/layout.tsx`（本仓库第一方）
