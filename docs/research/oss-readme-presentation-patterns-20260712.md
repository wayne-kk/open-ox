# 调研：高逼格开源项目 README 呈现模式（2026-07-12）

**状态**：完成（仅第一方 raw README / 官方仓库落地页）  
**日期**：2026-07-12  
**问题**：高声誉开源项目（尤其 AI / 开发者工具）如何在 README / intro 页呈现自己，才能显得 premium / 高逼格？Open-OX 若要写一份**双语文案、功能大纲型**（非 Quick Start）README，应学什么结构？

**方法**：逐个 `WebFetch` / `curl` 拉取 GitHub raw README（及存在的 `README.zh-CN.md` / `docs/zh-CN/README.md` / `i18n/`）。每条结论附 **raw URL**。不发明 Open-OX 产品功能；只提炼呈现模式。

**范围**：Hero、媒体、双语、功能卖点、架构/对比、刻意弱化的内容。

---

## 1. 结论摘要（给 Open-OX 的可执行建议）

| 模式 | 高逼格做法 | 低逼格 / 应避免 |
|------|------------|-----------------|
| **Hero** | 居中 logo（含 light/dark）→ 一句定位 → 一行价值主张 → **精选** badges → **立即**跟产品媒体 | 徽章墙堆满、无媒体、先贴一长串 env vars |
| **媒体** | Hero 后 1 张 cover / GIF / screencast；功能节配截图；架构用 SVG | 无图、或 10+ 张无说明截图瀑布 |
| **双语** | EN 主 `README.md` + `README.zh-CN.md`（或 `docs/zh-CN/`），顶部语言切换链接 | 同页中英双栏（几乎无人用）；外链机翻站 |
| **卖点** | `Why X` / `Key features` / capability checklist **先于** install | Install 抢首屏；把 README 写成运维手册 |
| **架构 / 对比** | 一张 architecture 图 + 短列表；或 OSS vs Cloud 对比图 | 无图的长散文；过早的 API 细节 |
| **弱化** | env / 系统要求 / 多路径部署 → docs 或折叠；README 只留「一条最短路径」链接 | 把完整 env 表贴在主 README |

**一句话**：premium README = **品牌首屏 + 立刻看见产品 + 用 Why/Features 卖能力 + 安装/环境推到文档**；双语用 **镜像文件 + 顶部切换**，不要双栏。

---

## 2. 逐项目发现（均附 raw 来源）

### 2.1 Vite — 极简品牌工具链

**来源**：https://raw.githubusercontent.com/vitejs/vite/main/README.md

- **Hero**：`<picture>` + `prefers-color-scheme` 切换官网 SVG logo；下方 npm/node/CI/discord badges；`# Vite ⚡` + blockquote tagline + 6 条 emoji 能力要点。
- **媒体**：Hero **只有 logo**，无产品截图（工具链类常见）。
- **双语**：无。
- **功能大纲**：6 条 bullet 即卖点；正文两段解释 dev server / build，然后链到 docs。
- **弱化**：无 install 命令、无 env；贡献与 packages 表在后。

### 2.2 Astro — Banner 即品牌

**来源**：https://raw.githubusercontent.com/withastro/astro/main/README.md

- **Hero**：全宽 `![Build the web you want](.github/assets/banner.jpg)`；居中一句话定位；CI/License/npm badges。
- **媒体**：相对路径 `.github/assets/banner.jpg`；无 GIF。
- **功能大纲**：几乎没有 Features 节；**Install 很靠前**（`npm create astro@latest`），其余推 docs/Discord。
- **弱化**：能力叙事交给官网；README 偏 monorepo 目录表。

### 2.3 Next.js — 信任背书极简页

**来源**：
- Root `canary/README.md` → 404 / 重定向到 packages
- 实际内容：https://raw.githubusercontent.com/vercel/next.js/canary/packages/next/README.md
- Root 指针：https://raw.githubusercontent.com/vercel/next.js/canary/readme.md

- **Hero**：居中 logo + 一排官方链接（Website / Documentation / Blog / Showcase / Discord / Discussions）。
- **媒体**：无产品截图。
- **叙事**：一句「used by some of the world's largest companies」+ Learn / Showcase 链接；无 Features 列表。
- **弱化**：完全不写 install；安全披露单独一节。**极高品牌、极低操作噪音。**

### 2.4 Supabase — Checklist + Dashboard + Architecture（教科书级平台 README）

**来源**：https://raw.githubusercontent.com/supabase/supabase/master/README.md  
**中文镜像**：https://raw.githubusercontent.com/supabase/supabase/master/i18n/README.zh-cn.md

- **Hero**：`#gh-light-mode-only` / `#gh-dark-mode-only` 双 logo（GitHub 附件 URL）；一句定位；`[x]` 能力 checklist（每项链 docs）。
- **媒体**：
  - Dashboard：`![Supabase Dashboard](https://raw.githubusercontent.com/.../supabase-dashboard.png)`
  - 小 GIF：`<kbd><img src=".../watch-repo.gif"></kbd>`
  - Architecture：`![Architecture](apps/docs/public/img/supabase-architecture.svg)`（相对路径）
- **双语**：主 README 底部 **Translations** 列表 → `/i18n/README.zh-cn.md` 等；**非双栏**。
- **功能大纲**：checklist 即卖点；`## How it works` + 架构图 + 组件短文；客户端库大表。
- **弱化**：**无 Quick Start install**；hosted / self-host 链到 docs。

### 2.5 shadcn/ui — 极简「一图一句话」

**来源**：https://raw.githubusercontent.com/shadcn-ui/ui/main/README.md

- **Hero**：标题 + 一段品牌句（Open Source / Open Code）+ `![hero](apps/v4/public/opengraph-image.png)`。
- **其余**：Documentation / Contributing / License。**无 install、无 badges 墙。** 逼格来自克制。

### 2.6 Vercel AI SDK — Hero GIF + 概念卖点 + 用法示例

**来源**：
- Root：https://raw.githubusercontent.com/vercel/ai/main/README.md（指针到 packages）
- 正文：https://raw.githubusercontent.com/vercel/ai/main/packages/ai/README.md

- **Hero**：`![hero illustration](https://github.com/vercel/ai/blob/HEAD/assets/hero.gif)`（**GIF**）；`# AI SDK` + 一段 provider-agnostic 定位。
- **卖点节**：`## Unified Provider Architecture`（概念先于细节）；再 Installation / Usage 代码块。
- **弱化**：完整 UI 集成很长，但 env 细节少；模板/社区链出。

### 2.7 LangChain.js — Logo + Why 列表 + 生态

**来源**：https://raw.githubusercontent.com/langchain-ai/langchainjs/main/README.md

- **Hero**：居中 logo 图 + 「The agent engineering platform.」+ npm/License/Twitter badges。
- **功能大纲**：`## 🚀 Why use LangChain?` 六条加粗卖点；`## 📦 LangChain's ecosystem` 产品矩阵。
- **媒体**：几乎无产品截图（框架库）。
- **弱化**：Quick Install 很短一行；Getting started 链 docs。

### 2.8 AutoGPT — 社媒/机翻多语 + 安装偏重（反面教材偏多）

**来源**：https://raw.githubusercontent.com/Significant-Gravitas/AutoGPT/master/README.md

- **Hero**：标题 + Discord/Twitter badges；**机翻站**语言链（`zdoc.app/...`），非仓库内镜像。
- **叙事**：Hosting Options → **大段 System Requirements / Docker / one-line install** 靠前。
- **功能大纲**：Frontend / Server / Example Agents 有卖点，但淹没在安装之后。
- **媒体**：少。
- **启示**：多语若外链机翻，**不抬逼格**；install-first 削弱产品感。

### 2.9 Stagehand — Light/dark logo + Why 三段 + 最短入口

**来源**：https://raw.githubusercontent.com/Browserbase/Stagehand/main/README.md

- **Hero**：`<picture>` dark/light logo（`media/dark_logo.png` / `media/light_logo.png`）；`<strong>The AI Browser Automation Framework</strong>`；docs 链接；自定义 license/discord 图（亦 light/dark）。
- **功能大纲**：`## What is Stagehand?` → `## Why Stagehand?`（对比 Selenium/Playwright vs 不可靠 agent）→ 三条编号卖点 → **一行** `npx create-browser-app` → Example 代码。
- **弱化**：`.env` / build from source **排在 Documentation 之后**。

### 2.10 E2B — `#gh-*-mode-only` logo + What is + 最短 sandbox 路径

**来源**：https://raw.githubusercontent.com/e2b-dev/E2B/main/README.md

- **Hero**：
  ```html
  <img src="/readme-assets/logo-black.png#gh-light-mode-only" ...>
  <img src="/readme-assets/logo-white.png#gh-dark-mode-only" ...>
  ```
  + 下载量 badges；cover 图用 HTML 注释关掉（`<!-- ... preview.png -->`）。
- **结构**：`## What is E2B?` → `## Run your first Sandbox`（短步骤）→ Self-hosting 链到别的 repo。
- **弱化**：完整 infra 不塞主 README。

### 2.11 Firecrawl — Logo + Why + Feature 表 + OSS vs Cloud 图

**来源**：https://raw.githubusercontent.com/firecrawl/firecrawl/main/README.md

- **Hero**：居中大 logo（`img/firecrawl_logo.png` raw URL）+ license/downloads/contributors badges + 社媒 for-the-badge；标题 + **加粗 one-liner**。
- **卖点**：`## Why Firecrawl?` 带数字的 bullet；`## Feature Overview` **Markdown 表**（Search/Scrape/Interact…）。
- **对比**：`## Open Source vs Cloud` + `![Open Source vs Cloud](.../img/open-source-cloud.png)`。
- **媒体路径**：`https://raw.githubusercontent.com/firecrawl/firecrawl/main/img/...`。
- **注意**：Quick Start / SDK 很长——卖点在前，细节在后；仍偏「API 文档化」。

### 2.12 Biome — Slogan SVG（light/dark）+ 语言切换条 + 克制卖点

**来源**：https://raw.githubusercontent.com/biomejs/biome/main/packages/@biomejs/biome/README.md  
（root README 仅指针到该文件）

- **Hero**：`<picture>` slogan SVG（dark/light，托管在 `biomejs/resources`）；CI/Discord/npm/VSCode badges。
- **双语**：首屏管道链接：`English | … | [简体中文](.../README.zh-CN.md) | …`（同目录多文件）。
- **卖点**：三段加粗定位（formatter / linter / editor）；`## More about Biome` 哲学要点。
- **弱化**：Install 短；无 env 墙。

### 2.13 Cal.com → Cal.diy — Logo + About 大截图 + 差异说明（install 仍很长）

**来源**：https://raw.githubusercontent.com/calcom/cal.com/main/README.md  
（当前内容为 **Cal.diy** 社区版说明）

- **Hero**：居中 logo + 标题 + 短定位 + badges。
- **媒体**：`## About` 下全宽 booking-screen 截图（GitHub assets URL）。
- **卖点**：`### What's different from Cal.com?` 对比 bullet；Built With 技术栈。
- **弱化失败点**：Getting Started / Development / Deployment / Integrations **极长**——产品感被运维淹没。对 Open-OX：**学 About 截图 + 差异叙事，别学后半本手册。**

### 2.14 Twenty — 居中品牌 + light/dark cover + Why + 功能图廊

**来源**：https://raw.githubusercontent.com/twentyhq/twenty/main/README.md

- **Hero**：logo → `#1 Open-Source CRM` → Website/Docs/Roadmap/Discord/Figma 链接行 → **`<picture>` light/dark cover webp**（`packages/twenty-website/public/images/readme/github-cover-{light,dark}.webp`）。
- **卖点**：`# Why Twenty`（折叠 Learn more）→ Installation 三条路径（Cloud / CLI / Self-host）→ `# Everything you need` **多组 light/dark 功能截图** + Learn more 链 docs。
- **双语**：无。
- **启示**：功能节用 **成对截图** 卖能力，不写长 install。

### 2.15 NocoDB — Logo + 演示视频附件 + 语言旗标 + 截图瀑布

**来源**：https://raw.githubusercontent.com/nocodb/nocodb/develop/README.md  
**中文**：https://raw.githubusercontent.com/nocodb/nocodb/develop/markdown/readme/languages/chinese.md

- **Hero**：品牌图 + 一句定位 + 社区链接；**演示媒体**：`![video avi](https://github.com/nocodb/nocodb/assets/.../e2fad786-....)`（GitHub assets，可播）。
- **双语**：旗标图片链到 `markdown/readme/languages/*.md`；`See other languages »`。
- **结构**：Community → **Installation 靠前且很长** → Screenshots 瀑布 → Features → Why / Mission。
- **启示**：演示视频好；install-before-screenshots **削弱逼格**。

### 2.16 Dify — Cover + 徽章语言切换 + Key features（强 CN+EN）

**来源**：
- EN：https://raw.githubusercontent.com/langgenius/dify/main/README.md
- ZH：https://raw.githubusercontent.com/langgenius/dify/main/docs/zh-CN/README.md

- **Hero**：`![cover-v5-optimized](./images/GitHub_README_if.png)`；居中 Cloud / Self-hosting / Docs 链接；**密集但分区的 badges**；**语言切换用 shield 徽章**：
  - `./README.md`（English）
  - `./docs/zh-CN/README.md`（简体中文）
  - 另有 JP / 等
- **结构张力**：`## Quick start`（Docker）在 **Key features 之前**——实用，但不如 Supabase/Twenty「先卖后装」高级。
- **功能大纲**：`## Key features` 编号 1–7，中间插 providers 截图；`## Using Dify` Cloud / Community / Enterprise。
- **双语**：完整镜像在 `docs/zh-CN/README.md`，封面图相对路径 `../../images/...`。**这是 CN+EN 标杆之一。**

### 2.17 NextChat（ChatGPT-Next-Web）— 顶部 EN/ZH 切换 + 截图；env 表过重

**来源**：
- EN：https://raw.githubusercontent.com/ChatGPTNextWeb/ChatGPT-Next-Web/main/README.md
- ZH：https://raw.githubusercontent.com/ChatGPTNextWeb/ChatGPT-Next-Web/main/README_CN.md

- **Hero**：居中标题；`English / [简体中文](./README_CN.md)`；one-liner；平台 badges；一键 Deploy 按钮。
- **媒体**：`./docs/images/settings.png`、`more.png`、`cover.png`（相对 `docs/images/`）。
- **卖点**：`## Features` / Roadmap / What's New；Enterprise Edition 列表。
- **弱化失败**：`## Environment Variables` **超长**贴在主 README——部署向社区产品常见，但 **不 premium**。

### 2.18 LobeHub / Lobe Chat — Banner + TOC + 嵌入视频 + Features 配图 + 镜像 ZH

**来源**：
- EN：https://raw.githubusercontent.com/lobehub/lobe-chat/main/README.md
- ZH：https://raw.githubusercontent.com/lobehub/lobe-chat/main/README.zh-CN.md

- **Hero**：`[![][image-banner]][vercel-link]`（footer 定义 `image-banner` → user-attachments）；定位短诗；`**English** · [简体中文](./README.zh-CN.md) · Official Site · …`；多层 shields；`<details><summary>Table of contents</summary>`。
- **媒体**：裸链接视频  
  `<https://github.com/user-attachments/assets/0a33365f-...>`  
  （GitHub 渲染为可播放视频）；Features 各节 `![](https://github.com/user-attachments/assets/...)`。
- **结构**：Getting Started / Community → **✨ Features（先卖）** → Self Hosting → Environment Variable（表 + **完整列表链 docs**）。
- **启示**：徽章可以多，但要 **分区**；env **摘要表 + 文档外链** 比 NextChat 全量表更体面。

### 2.19 Aider — Logo + Screencast SVG + Features 图标条 + 社会证明

**来源**：https://raw.githubusercontent.com/Aider-AI/aider/main/README.md

- **Hero**：居中 `https://aider.chat/assets/logo.svg`；H1 tagline；一句说明；**全宽 screencast**：`https://aider.chat/assets/screencast.svg`；精选 metrics badges（stars / installs / tokens）。
- **功能大纲**：`## Features` 每项 = 小图标 + 一句能力 + 链 docs；**无大段安装**。
- **Getting Started**：短命令块；细节链 `aider.chat/docs`。
- **额外**：长「Kind Words」引用区（社会证明）。
- **双语**：无。**AI 编程工具逼格标杆：演示动画 + 能力目录 + install 极短。**

---

## 3. 横切模式（对应你的 6 个焦点）

### 3.1 Hero 结构

常见顺序（高逼格交集）：

1. **居中 logo**（常带 light/dark）
2. **产品名 / 一句 slogan**（H1 或 strong）
3. **一行价值主张**
4. **导航链**（Website · Docs · Discord）或语言切换
5. **精选 badges**（license / stars / npm / CI——避免整页盾牌）
6. **Hero 媒体**（cover webp / GIF / screencast / 嵌入视频）

参考：Twenty、Aider、Stagehand、Supabase、Firecrawl、Dify、Lobe。

### 3.2 媒体：位置与 Markdown 模式

| 模式 | 示例 | 用法 |
|------|------|------|
| 相对路径图 | Astro `.github/assets/banner.jpg`；NextChat `./docs/images/cover.png`；Supabase `apps/docs/public/img/supabase-architecture.svg` | 仓库内可控资源 |
| Raw GitHub URL | Firecrawl `https://raw.githubusercontent.com/.../img/logo.png` | 保证外链稳定 |
| GitHub assets / user-attachments | NocoDB 视频；Lobe 截图与视频；AI SDK `blob/HEAD/assets/hero.gif` | GIF / 视频友好 |
| `<picture>` + `prefers-color-scheme` | Vite、Twenty、Stagehand、Biome | 现代浏览器 / GitHub |
| `#gh-light-mode-only` / `#gh-dark-mode-only` | E2B、Supabase logo | GitHub 原生主题切换 |
| 裸 `https://github.com/user-attachments/assets/...` | Lobe | 渲染为视频播放器 |
| 官网托管 screencast SVG | Aider `aider.chat/assets/screencast.svg` | 终端/CLI 演示极干净 |
| YouTube iframe | **本批样本几乎不用**在 README 内嵌 | 多用外链；优先 GIF/SVG/assets |

**放置位置**：Hero 后立刻一块主媒体；功能节「一文一图」；架构/对比单独一节一张图。避免 NocoDB 式无说明截图瀑布抢叙事。

### 3.3 双语 / i18n

| 策略 | 谁在用 | 取舍 |
|------|--------|------|
| **EN 主 README + 同目录 `README.zh-CN.md`，顶部文字切换** | Lobe、Biome（另有多语）、NextChat（`README_CN.md`） | **推荐**：维护清晰，GitHub 默认显示 EN |
| **EN 主 + `docs/zh-CN/README.md`，徽章切换** | Dify | 适合 docs 已分语言目录；切换可见性高 |
| **`i18n/README.zh-cn.md` + 底部语言列表** | Supabase | 可扩展多语；中文入口略深 |
| **`markdown/readme/languages/chinese.md` + 旗标** | NocoDB | 视觉花；路径非惯例 |
| **外链机翻** | AutoGPT → zdoc.app | **不推荐** |
| **同页中英双栏** | **本批无人采用** | GitHub 窄栏难读，维护成本高 |

**结论**：Open-OX 用 **EN `README.md` + `README.zh-CN.md`（内容镜像）+ 顶部 `English · 简体中文`**；可选再学 Dify 用 badge 强化切换。不要双栏。

### 3.4 功能大纲（卖能力，不是 Quick Start）

高分结构：

1. **What is X**（1 段）
2. **Why X**（对比旧世界 / 竞品类别，3–6 条）— Stagehand、Firecrawl、LangChain、Twenty
3. **Key features / Everything you need**（编号或表；每项可配图）— Dify、Aider、Lobe、Supabase checklist、Firecrawl 表
4. **最短试用路径**（一行命令或链 Cloud）— 不要展开
5. Architecture / Ecosystem / Comparison（可选）
6. Docs / Community / Contributing

### 3.5 架构图、对比表、Why

- **架构图**：Supabase SVG + 组件 bullet（最清晰）。
- **对比图/节**：Firecrawl OSS vs Cloud 图；Cal.diy vs Cal.com bullet；Stagehand 文内对比。
- **Why**：几乎所有 AI/devtool 精品都有；用 **决策语言**（何时用 AI vs 代码、为何可靠）而非功能清单重复。

### 3.6 刻意省略或降级

| 内容 | Premium 做法 | 反例 |
|------|--------------|------|
| Install | 一行 / 链 docs；Cloud 优先 | AutoGPT / NocoDB / Cal 长安装 |
| Env vars | 摘要表 + 完整列表进 docs（Lobe） | NextChat 主 README 全量表 |
| 系统要求 | 折叠或 docs（Dify 用 blockquote 短列尚可） | AutoGPT 硬件/网络长列表靠前 |
| Monorepo 包表 | Vite/Astro 可放后 | 勿当首屏 |
| Star history / contributors | 页脚装饰 | 勿压过产品媒体 |

---

## 4. Open-OX 推荐：双语「功能大纲」README（非 Quick Start）

### 4.1 推荐章节顺序

```text
1. Hero（logo light/dark · 品名声称 · 一行主张 · EN/ZH 切换 · 精选 badges）
2. Hero 媒体（cover 或 demo GIF/视频）
3. What is Open-OX（1 短段）
4. Why Open-OX（3–5 条决策向卖点）
5. Capabilities / Features（编号；每 1–2 项配截图；可用表做总览）
6. How it works / Architecture（一张图 + 短列表）
7. （可选）Compare — e.g. hosted vs self-serve / 边界说明（勿编造未有功能）
8. Get started（仅：最短一条路径 + Docs 链接；无 env 全表）
9. Community · Contributing · License
```

ZH 文件 `README.zh-CN.md` **同序镜像**；顶部互相链接。

### 4.2 占位 Markdown（资源放 `docs/assets/readme/`）

```markdown
<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/logo-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/readme/logo-light.svg" />
    <img alt="Open-OX" src="docs/assets/readme/logo-light.svg" width="160" />
  </picture>

  <h1>Open-OX</h1>
  <p><strong><!-- one-line product claim --></strong></p>
  <p><!-- supporting sentence --></p>

  <p>
    <strong>English</strong> ·
    <a href="./README.zh-CN.md">简体中文</a> ·
    <a href="<!-- docs url -->">Docs</a>
  </p>

  <p>
    <!-- keep to 3–5 shields -->
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-TODO-blue" alt="License" /></a>
  </p>
</div>

<!-- Hero demo: prefer GIF/webp; or GitHub user-attachments video URL on its own line -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/hero-dark.webp" />
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/readme/hero-light.webp" />
    <img src="docs/assets/readme/hero-light.webp" alt="Open-OX product overview" width="900" />
  </picture>
</p>

<!-- Optional motion demo -->
<p align="center">
  <img src="docs/assets/readme/demo.gif" alt="Open-OX demo" width="900" />
</p>

## Why Open-OX

1. **…**
2. **…**
3. **…**

## Capabilities

| Area | What you get |
|------|----------------|
| … | … |

### Capability A

Short sell paragraph — not install steps.

![Capability A](docs/assets/readme/feature-a.png)

### Capability B

![Capability B](docs/assets/readme/feature-b.png)

## Architecture

![Architecture](docs/assets/readme/architecture.svg)

- Component A — one sentence
- Component B — one sentence

## Get started

The shortest path lives in the docs — not here.

```bash
# one recommended command only, or link to hosted signup
```

Full setup, environment variables, and deployment options: [Documentation](<!-- docs -->).

## Community

…

## License

…
```

**Light/dark 备选（GitHub hash 语法，E2B/Supabase 同款）**：

```markdown
<p align="center">
  <img src="docs/assets/readme/logo-light.svg#gh-light-mode-only" alt="Open-OX" width="160" />
  <img src="docs/assets/readme/logo-dark.svg#gh-dark-mode-only" alt="Open-OX" width="160" />
</p>
```

**嵌入演示视频（Lobe 同款）**：上传到 GitHub 后单独一行：

```markdown
https://github.com/user-attachments/assets/<asset-id>
```

### 4.3 双语布局建议（带权衡）

| 选项 | 建议 | 权衡 |
|------|------|------|
| **A. EN 主 + `README.zh-CN.md` 镜像** | **首选**（Lobe / Biome / NextChat） | 改两份；默认访客见 EN |
| **B. EN 主 + `docs/zh-CN/README.md` + badge 切换** | 若中文文档已在 `docs/zh-CN`（Dify） | 路径更深；badge 更醒目 |
| **C. Supabase 式 `i18n/` 列表** | 仅当计划 ≥5 语言 | 中文入口弱 |
| **D. 双栏同页** | **否** | 样本中不存在；难维护 |

ZH 文件顶部应对称：

```markdown
**[English](./README.md)** · 简体中文
```

### 4.4 资产清单（重写前准备）

放在 `docs/assets/readme/`（或 `.github/assets/`——Astro 风格；二选一并统一）：

- `logo-light.svg` / `logo-dark.svg`
- `hero-light.webp` / `hero-dark.webp`（或单一 `demo.gif`）
- `feature-*.png|webp`（每能力 1 张，忌瀑布）
- `architecture.svg`
- （可选）`compare-oss-cloud.png` 仅当确有边界可画

---

## 5. 样本覆盖状态

| 项目 | Raw URL | 状态 |
|------|---------|------|
| Next.js | `packages/next/README.md`（root 404/指针） | 已读 |
| Vite | `vitejs/vite/main/README.md` | 已读 |
| Astro | `withastro/astro/main/README.md` | 已读 |
| Supabase | `supabase/supabase/master/README.md` + `i18n/README.zh-cn.md` | 已读 |
| shadcn/ui | `shadcn-ui/ui/main/README.md` | 已读 |
| Vercel AI | `vercel/ai/main/packages/ai/README.md` | 已读 |
| LangChain.js | `langchain-ai/langchainjs/main/README.md` | 已读 |
| AutoGPT | `Significant-Gravitas/AutoGPT/master/README.md` | 已读 |
| Stagehand | `Browserbase/Stagehand/main/README.md` | 已读 |
| E2B | `e2b-dev/E2B/main/README.md` | 已读 |
| Firecrawl | `firecrawl/firecrawl/main/README.md` | 已读 |
| Biome | `packages/@biomejs/biome/README.md` | 已读 |
| Cal.com | `calcom/cal.com/main/README.md`（现为 Cal.diy） | 已读 |
| Twenty | `twentyhq/twenty/main/README.md` | 已读 |
| NocoDB | `nocodb/nocodb/develop/README.md` | 已读 |
| Dify | `langgenius/dify/main/README.md` + `docs/zh-CN/README.md` | 已读 |
| NextChat | `ChatGPTNextWeb/.../README.md` + `README_CN.md` | 已读 |
| Lobe | `lobehub/lobe-chat/main/README.md` + `README.zh-CN.md` | 已读 |
| Aider | `Aider-AI/aider/main/README.md` | 已读 |

---

## 6. 重写 Open-OX README 时的检查清单

- [ ] 打开 README，**不滚动**即可看到：品牌、一句主张、主视觉
- [ ] 前两屏内出现 Why / Capabilities；**看不到** env 全表
- [ ] 媒体 ≤ 合理数量且每张有标题语境；light/dark 已测
- [ ] `README.zh-CN.md` 与 EN 同结构，顶部可互跳
- [ ] Get started 只有一条最短路径 + Docs
- [ ] 未编造产品能力；对比节只写真实边界
