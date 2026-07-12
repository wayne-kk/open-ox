<p align="center">
  <!-- MEDIA: docs/assets/readme/banner.png（约 1920×640） -->
  <img src="docs/assets/readme/banner.png" alt="Open-OX" width="720" />
</p>

<p align="center">
  <strong>Open-OX</strong><br />
  AI-native 网站生产引擎
</p>

<p align="center">
  <em>Think it. Build it. Run it.</em>
</p>

<p align="center">
  一句自然语言 Brief，拿走的是<strong>可运行、可构建、可预览、可修改、可部署</strong>的真实 Next.js 工程——不是截图，不是沙箱幻觉。
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
  ·
  <a href="./CONTEXT.md">术语表</a>
  ·
  <a href="./docs/adr/">ADRs</a>
  ·
  <a href="./docs/product-iteration-outline.md">路线图</a>
</p>

---

> **媒体占位 — Hero / Demo**  
> 放入 `docs/assets/readme/hero.png`（Studio：管线 + 预览，16:9，≥1600px）。  
> 可选：YouTube / Bilibili 演示片 —— 海报图外包链接（见 `docs/assets/readme/PLACEHOLDERS.md`）。

<p align="center">
  <img src="docs/assets/readme/hero.png" alt="Open-OX Studio — 生成管线与实时预览" width="900" />
</p>

<p align="center">
  <!-- 上传演示后替换 YOUR_* -->
  <a href="https://www.youtube.com/watch?v=YOUR_YOUTUBE_ID">▶ 演示（YouTube）</a>
  ·
  <a href="https://www.bilibili.com/video/YOUR_BV">Bilibili</a>
</p>

---

## 为什么是 Open-OX

多数 AI 建站停在「看起来像网站」。Open-OX 走的是**软件工程产线**：结构化意图、设计系统、多 Agent 实现、构建门禁与自愈、Studio 全链路可追溯，以及通往**你自己的**生产托管的路径。

| 常见做法 | Open-OX |
|----------|---------|
| 截图 / iframe 戏法 | 磁盘上的真实 Next.js 源码 |
| 生成一次就结束 | 对话 Modify + Design Mode 写回 |
| 黑盒结果 | 流式管线节点、可审计 Agent 轨迹 |
| 平台锁死托管 | 工程可导出 · **BYO Vercel** 一键 Deploy |
| 「差不多」的 HTML | 安装 → 构建 → 定向修复，直到能编译 |

**野心：** 成为个人与小团队从 Brief 到可交付 Next.js 站点的默认路径——而不是再雇一轮外包「把 AI 草稿修成能上线的东西」。

---

## 能力大纲

### 1. Prompt → Project — 工程管线，不是一个超级 Prompt

生成被拆成**输入输出清晰的固定节点**。失败可定位；重试成本远低于「整站重骰」。

1. **Intent Agent** — 把随口一说收成可执行 Brief  
2. **设计意图** — 从文案与参考图推断视觉方向  
3. **项目规划** — 模块受规格约束，而不是自由膨胀  
4. **设计系统** — token / 字阶 / 间距全站共享  
5. **Architect 脚手架** — 一次架构 pass，再进入可实现结构  
6. **Page Implement Agents** — 工具循环写出对齐系统的真实 TSX  
7. **依赖安装** — 识别并装上构建所需  
8. **构建 + 自动修复** — 编译门禁；失败则定向 repair  

> **媒体占位 — 管线**  
> `docs/assets/readme/pipeline.svg`（或 `.png`）— 八节点示意图。

<p align="center">
  <img src="docs/assets/readme/pipeline.png" alt="Open-OX 生成管线" width="900" />
</p>

---

### 2. 设计系统与视觉弹药库

- **Design System 先行** — 一致性靠结构，不靠运气  
- **30+ Style Skills** — Swiss Minimal、Neo-Brutalism、Glassmorphism、Cyberpunk、Art Deco、Terminal、Luxury…  
- **Hero 技能矩阵** — WebGL / shader / 粒子 / 卷轴变形，在 Brief 值得存在感时上场  
- **参考图双模式**  
  - **复刻（Replicate）** — 布局保真  
  - **提取灵感（Extract）** — 借色与气质，不机械描摹  
  - 深度视觉分析 → 约束 → 实现（降低 design drift）

---

### 3. Studio — 透明、可改、可精修

- **全链路 Trace** — 拓扑、日志、Agent 步骤随站点诞生流式呈现  
- **Modify Agent** — 自然语言改站：读 / 搜 / 编 / 构建；结构化 diff、历史 turn、可控记忆边界  
- **Design Mode** — 预览里点选元素，调颜色、字号、间距、圆角。定位键是编译期 `file:line:col`（`data-ox-source`）；服务端 JSX AST **Direct Apply** 并验证。搞不定则 handoff Modify 草稿——人确认，绝无静默第二套写盘引擎  
- **Brief / 纲要确认**（产品方向）— 先对齐结构，再烧高成本生成 token  

> **媒体占位 — Design Mode**  
> `docs/assets/readme/design-mode.png`

<p align="center">
  <img src="docs/assets/readme/design-mode.png" alt="Open-OX Design Mode — 点选精修" width="900" />
</p>

---

### 4. 预览：可靠，而不是碰巧能开

| 后端 | 何时用 |
|------|--------|
| **静态导出 → Storage + `/site-previews` 代理** | 确定性可分享 URL；Storage 配好时的默认路径 |
| **Per-site `next dev`** | 需要 HMR 与 Design Mode 源码插桩 |
| **E2B 沙箱** | 隔离云端运行时 — 创建 / 重连 / 重建 |

稳定预览是产品契约的一部分——不是事后塞进 iframe。

---

### 5. Workspace · Community · Remix

可见性被认真设计过——不是「登录就能看见所有人的项目」。

- **Workspace** — 业主私有项目（含文件夹）；创建与编辑的默认家  
- **Publish Preview** — 主动开启后才进 **Community**；访客只能看静态预览——拿不到 Studio / 源码编辑权  
- **Allow Remix** — 与 Publish Preview 解耦的复制许可（仅在公开预览开启时有效）。登录用户 Remix 成**自己的新项目**（最新站点快照，不含密钥与 Studio 对话），并记录 lineage  
- 关闭 Publish Preview 立即下架；已 Remix 副本独立存活  

> **媒体占位 — Community**  
> `docs/assets/readme/community.png`

<p align="center">
  <img src="docs/assets/readme/community.png" alt="Open-OX Community 与 Remix" width="900" />
</p>

---

### 6. 交付 — 导出与 BYO Deploy

- **工程导出** — 带走真实代码库，接入自有仓库  
- **BYO Vercel Deploy**（ADR-0003）  
  - OAuth Integration 连入**你的** Vercel 账号与账单  
  - 静态 `out/` 经 Files + Deployments API 上传  
  - 首次 Deploy 建项并持久绑定；后续一键再发  
  - **Publish Preview ≠ Deploy** — 发现与生产是两条轴  
  - Disconnect 只清 Open-OX 侧凭证与绑定——**绝不**删远端 Vercel 项目  
- **Integrations 设置** — 连接、团队、回跳 Studio  

> **媒体占位 — Deploy**  
> `docs/assets/readme/deploy.png`

<p align="center">
  <img src="docs/assets/readme/deploy.png" alt="Open-OX BYO Vercel Deploy" width="900" />
</p>

---

### 7. Credits

- 计量：LLM tokens → USD → **Credits**（生成 / 修改）  
- Design Mode Direct Apply **不耗 Credits**  
- Free：日常赠额 + 月度上限；Pro / 加油包走 Stripe（`/pricing`）  
- 用量透明——贵在清楚，不在玄学扣费  

---

## 架构

```text
Browser · Studio UI
   └─ Next.js API（SSE 编排）
        ├─ AI Flows
        │    ├─ generate_project
        │    └─ modify_project
        ├─ Supabase（注册 · RLS · Storage）
        └─ Preview / Deploy
             ├─ /site-previews · local next dev · E2B
             └─ BYO Vercel OAuth → 生产 URL
```

> **媒体占位 — 架构图**  
> `docs/assets/readme/architecture.svg`

<p align="center">
  <img src="docs/assets/readme/architecture.svg" alt="Open-OX 架构" width="900" />
</p>

| 路径 | 职责 |
|------|------|
| `ai/flows/generate_project` | 端到端生成 |
| `ai/flows/modify_project` | 工具循环修改 |
| `app/studio` | Studio：拓扑、trace、Design Mode |
| `lib/staticSitePreview.ts` · `lib/previewMode.ts` · `lib/vercel/` | 预览后端与 BYO Deploy |
| `sites/` | 每项目工作区 |
| `public/skills/` | 风格技能包 |
| `CONTEXT.md` · `docs/adr/` | 术语与决策 |

---

## 技术栈

| 层 | 选型 |
|----|------|
| 应用 | Next.js 16 · React 19 · TypeScript |
| UI | Tailwind CSS v4 · shadcn / Radix · Framer Motion · Three.js |
| 数据 | Supabase（Postgres + Storage + RLS） |
| 预览 | Storage 静态 · 本地 `next dev` · E2B |
| 部署 | Vercel Integration OAuth |
| 模型 | OpenAI-compatible API |
| 可观测 | Langfuse · Studio SSE traces |
| 计费 | Stripe · Credits |

---

## 设计押注

1. **可验证优于炫技** — 构建不过、预览不稳、diff 不可读，再漂亮也是负债。  
2. **透明优于黑盒** — 用 Studio traces 评价系统。  
3. **修改一等公民** — 生成点火；Modify + Design Mode 巡航。  
4. **交付物归你** — 源码可导出；生产站在你的 Vercel 上。  
5. **约束换质量** — 先把高完成度单首页做透；门禁稳住再放开多页。

---

## 一句话

**Open-OX = 意图 × 设计系统 × 多 Agent 实现 × 构建自愈 × 透明 Studio × 社区 Remix × BYO 部署。**

不是又一个「AI 写网站」玩具。  
是把网站生产做成一条**可重复、可审计、可交付**的流水线。

---

## 本地启动

```bash
cp .env.example .env.local
# 填写 Core 段（Supabase + OpenAI 兼容 API + 站点 URL）
pnpm check:env
pnpm dev
```

可选能力（飞书 / Google / Stripe / Vercel / E2B / Langfuse / Ark）按需配置；未配置时对应 UI 不会出现。完整变量见 `.env.example`，能力判断见 `lib/env.ts`。

---

## 文档

- 术语表 — [`CONTEXT.md`](./CONTEXT.md)  
- 架构决策 — [`docs/adr/`](./docs/adr/)  
- 产品路线图 — [`docs/product-iteration-outline.md`](./docs/product-iteration-outline.md)  
- PRD — [`docs/product/`](./docs/product/)  
- README 媒体清单 — [`docs/assets/readme/PLACEHOLDERS.md`](./docs/assets/readme/PLACEHOLDERS.md)  

欢迎 Issue / PR。改管线行为时请留下 ADR 或产品说明——我们把「为什么」也当作交付的一部分。
