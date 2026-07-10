# 调研：Lovable 首页结构与 Dashboard 侧边栏（2026-07-10）

**状态**：完成（基于第一方公开材料：live site + 官方 docs）  
**日期**：2026-07-10  
**问题**：Lovable 营销首页如何组织信息架构与 CTA？登录后 Dashboard 侧边栏如何组织导航？Open-OX 首页改版 + 侧边栏应学什么、刻意不抄什么？

**范围说明**：本笔记覆盖 **营销首页 IA** 与 **Dashboard 侧边栏 / app shell**。不展开 Visual Edits、Publish/Remix 细节（见既有 `lovable-community-publish-remix-20260709.md`、`lovable-visual-edits-localization-20260709.md`）。

---

## 1. 结论摘要

| 缝 | Lovable（2026-07 第一方观察） | 对 Open-OX 的含义 |
|----|------------------------------|-------------------|
| **营销首页核心** | 首屏几乎只有品牌 + 一句价值主张 + **中央 Prompt 输入框**（Build） | 创建入口必须压倒一切；工程叙事放到首屏以下 |
| **营销页无侧栏** | 顶栏 Logo + Get started +（宽屏）Solutions/Resources/… 或汉堡菜单；侧栏是 **登录后产品壳** | 不要把 Workspace 侧栏塞进匿名营销首页 |
| **信任条** | Hero 下方「Teams from top companies…」+ logo 行 | Open-OX 可用社区作品 / 生成结果预览替代企业 logo（若无客户 logo） |
| **How it works** | 「Meet Lovable」三步：idea → come to life → refine & ship；配产品 UI 大图 | 把现有 8 节点流水线 **压缩成 3 步用户故事**，细节可折叠或进文档 |
| **发现面** | 「Discover templates」策展模板网格 + View all | 对齐 Open-OX **Community**（Publish Preview 作品），勿叫 Templates 除非真有策展模板库 |
| **社会证明数字** | 「Lovable in numbers」三大指标 | 有真实数据再用；否则保留工程向指标或删掉虚数 |
| **产品壳侧栏** | Dashboard 左侧持久侧栏：Workspace 切换、Home/Search/Resources/Connectors、Projects 分组、Recents、底部用户菜单 | Open-OX 应在 **Workspace / Community** 引入同类 app shell，替代纯顶栏 |

**一句话**：Lovable 把「创建」做成营销首页与 Dashboard 共用的 **Prompt-first 中心**；把「导航与项目组织」做成 **登录后左侧边栏**。Open-OX 应拆成两层改版——营销页学 Prompt-first 与更短故事；产品壳学侧栏，而不是把两者糊成一页。

---

## 2. 营销首页：信息架构（live site）

**来源**：[https://lovable.dev/](https://lovable.dev/)（2026-07-10 浏览器快照 + 页面可访问文本）

### 2.1 顶栏

| 元素 | 观察 |
|------|------|
| Logo | 左上「Lovable」心形图标 + 字标，链回首页 |
| 主 CTA | 「Get started」 |
| 导航 | 宽屏可见 Solutions / Resources / Community / Enterprise / Pricing 等；窄屏收进汉堡「Toggle navigation menu」 |
| 次 CTA | 「Log in」（部分视口/状态） |

营销首页 **没有** 左侧持久侧栏。

### 2.2 区块顺序（自上而下）

1. **Hero — Prompt-first**
   - 标题：`Build something Lovable`
   - 副文：`Create apps and websites by chatting with AI`
   - 中央大输入框：`+`（附加）、Plan mode 开关、Send / Build
   - 无大段功能说明、无统计条抢首屏

2. **Social proof strip**
   - 文案：`Teams from top companies build with Lovable`
   - 企业 logo 横排（灰度）

3. **Meet Lovable（产品故事，3 步 + 切换演示）**
   - `Start with an idea` — 描述或丢截图/文档
   - `Watch it come to life` — 实时变成可运行原型
   - `Refine and ship` — 反馈迭代 + 一键部署
   - 左侧步骤为可切换按钮（`aria-pressed`），右侧大尺寸产品 UI 面板随步骤切换（非静态三列卡）

4. **Discover templates**
   - 标题 + `View all` → `/templates`
   - 模板卡片网格（Maison、Inspo Canvas、Personal blog、Fashion blog、Continuum、Lovable slides、Prompt Frame、Ecommerce…）

5. **Lovable in numbers**
   - 三大规模指标（projects built / new per week / visits）；数字多为滚入视口后 count-up（自动化抓取时常先看到 `0M`）

6. **Ready to build?（收尾二次 Prompt）**
   - 再次放置与 Hero 同构的输入框 + Build（不是纯按钮 CTA）

7. **Footer** — Company / Product / Resources / Legal / Community + 语言切换

### 2.3 交互模式

| 模式 | 观察 | 来源 |
|------|------|------|
| 首屏唯一主任务 | 输入框未填时 Send 禁用；焦点在创建 | live site a11y tree |
| Build vs Plan | Hero 与 Dashboard 均有 mode toggle | live site；[Dashboard overview](https://docs.lovable.dev/introduction/dashboard-overview) |
| 营销 → 产品 | Get started / 提交 prompt 导向注册或 Dashboard | live site + docs |
| Sticky 顶栏 | `position: sticky; top: 0`；滚动后顶栏下可出现粉→橙渐变条 | live site DOM/截图 |
| 收尾二次 Prompt | 页底再次放创建框，降低回顶成本 | live site |
| 营销页无长 feature grid | Pricing/Enterprise 等进顶栏子页，首页保持短漏斗 | live site |

---

## 3. Dashboard 侧边栏：产品壳（官方 docs）

**来源**：[Dashboard overview](https://docs.lovable.dev/introduction/dashboard-overview)（第一方文档，非二手评测）

登录后 **Dashboard 是 home base**：中央仍是 prompt 创建；左侧侧栏承担全部工作区导航。

### 3.1 侧栏结构

```
┌ Workspace selector ─────────────┐
│ Home / Search / Resources /     │
│ Connectors                      │
│ ── Projects ──                  │
│   All projects (+ folder tree)  │
│   Starred                       │
│   Created by me                 │
│   Shared with me                │
│ ── Recents ──                   │
│   (recent projects)             │
│ …                               │
│ Referral / Upgrade cards        │
│ Avatar → User menu + Inbox      │
└─────────────────────────────────┘
```

| 能力 | 文档要点 |
|------|----------|
| 折叠 | 顶按钮或 `Cmd/Ctrl+B`；折叠后 hover tooltip |
| Workspace 切换 | 侧栏顶部点 workspace 名 |
| Search | `Cmd/Ctrl+K` 命令面板 |
| Projects 分组 | All / Starred / Created by me / Shared with me；All 可展开 folder 树 |
| Recents | 按最近访问 |
| User menu | Profile / Settings / Appearance / Support / Docs / Community / Homepage / Sign out |
| Inbox | 邀请与通知；另有 What’s new |

### 3.2 Dashboard 主区（与侧栏配合）

- Prompt 输入仍在中央（与营销首页同构）
- `+` 菜单：Attach / Design(templates) / Connectors
- Build vs Plan mode
- 项目访问默认 workspace（与 Community 发布解耦——见既有 remix 调研）

---

## 4. 与 Open-OX 现状对照

| 维度 | Lovable | Open-OX 现状（代码） |
|------|---------|----------------------|
| 营销首页 | Prompt-first，故事短 | `/`：`HeroPrompt` + HeroVisual + Stats + 8 节点 How it works + 6 能力卡 + CTA（`app/page.tsx`） |
| 顶栏 | 营销向链接 + Get started | `Navigation.tsx`：项目/社区/文档/测试页/changelog |
| Workspace | 侧栏 + 中央 prompt/列表 | `/projects` 全宽网格，**无侧栏**，仍用全局顶栏 |
| Community | 侧栏 Resources/Community 入口 + 策展模板 | `/community` 全宽 gallery，顶栏切换 |
| Studio | 项目内编辑器壳 | `/studio/[projectId]` 左右分栏（对话 \| Topology/Code/Preview），无全局侧栏 |
| 已有侧栏参考 | — | 仅 `DocsSidebar`、`AdminShell` |

产品定位（`CONTEXT.md` / README）：**AI-native website production engine**；Workspace = 私有项目面；Community = Publish Preview 发现面。叙事应是 **Harness / 工程流水线**，不是纯 vibe chat。

---

## 5. Adapt vs Avoid

### 建议学（Adapt）

1. **Prompt-first 首屏**：减少 badge / 长标题 / 首屏下方动画抢戏；创建框是唯一主 CTA。
2. **营销页与产品壳分离**：匿名看营销；登录后进带侧栏的 Workspace home（中央仍可放创建 prompt）。
3. **三步用户故事** 替代首屏级 8 节点拓扑；8 节点保留为可展开或 `/docs`。
4. **发现区块** 用 Community 精选/最新作品，对应 Lovable templates 槽位。
5. **侧栏 IA**：Home（创建）、我的项目（含文件夹）、社区、文档；底部用户菜单；可折叠。

### 建议不抄（Avoid）

1. 不把企业 logo 墙硬造；无客户背书就用真实生成结果。
2. 不引入 Connectors / 多 Workspace 计费卡，除非产品已有。
3. 不把 Shared with me / Starred 做满，除非协作模型已落地（当前 Workspace 是 owner-only）。
4. 不把 Studio 对话栏与全局侧栏混成一个导航——Studio 保持项目内壳。
5. 不把「聊天建站」作为唯一品牌语；保留 Open-OX 的 **可验证流水线 / 真实 Next.js** 差异化。

---

## 6. Implications for open-ox（改版输入）

详见可执行需求：`.scratch/homepage-redesign/PRD.md`。

要点：

- **P0**：`/projects` + `/community`（及登录后「应用首页」）引入 **AppSidebar**；顶栏在这些路由降级或隐藏。
- **P0**：营销 `/` 收敛为 Prompt-first + 短故事 + Community 发现 + 收尾 CTA；工程深度下沉。
- **P1**：登录用户访问 `/` 可选择「进 Workspace」或保留营销页双模式（需产品拍板）。
- **非目标**：本轮不改 Studio 内部分栏；不复制 Lovable 计费/Connectors。

---

## 7. 来源索引

| 主张 | 来源 |
|------|------|
| 首页区块与文案 | [lovable.dev](https://lovable.dev/) live DOM/a11y + 截图，2026-07-10 |
| Dashboard 侧栏分组、快捷键、User menu、Inbox | [docs.lovable.dev/introduction/dashboard-overview](https://docs.lovable.dev/introduction/dashboard-overview) |
| Open-OX 首页五段结构 | `app/page.tsx` |
| Open-OX 顶栏与 ConditionalNav | `app/components/Navigation.tsx`, `ConditionalNav.tsx` |
| Workspace / Community 术语 | `CONTEXT.md` |
| 既有 Lovable 工作区/发布调研 | `docs/research/lovable-community-publish-remix-20260709.md` |
