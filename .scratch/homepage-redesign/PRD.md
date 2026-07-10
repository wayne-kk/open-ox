# Open-OX 首页改版 + App 侧边栏 — 需求（v0.2）

**状态**：已确认（grilling 2026-07-10）  
**日期**：2026-07-10  
**依据**：`docs/research/lovable-homepage-app-shell-20260710.md`  
**范围**：营销首页 `/` 信息架构收敛；已登录 Workspace / Community 引入持久侧边栏。  
**非范围**：Studio 内部分栏、计费、多 Workspace、Connectors、协作 Shared-with-me、Community 精选模型、Recents/Starred。

---

## 0. 已锁定决策（grilling）

| # | 决策 | 选择 |
|---|------|------|
| 1 | 营销 vs 应用 | **`/` 永远营销**；登录后主入口 = 带侧栏的应用壳 |
| 2 | 应用 Home | **复用 `/projects`**：侧栏 + 顶置完整 `HeroPrompt` + 项目网格（不新建 `/home`） |
| 3 | 已登录访问 `/` | **不强制重定向**；多「进入工作台」；应用壳内 Logo → `/projects`；营销页 Logo → `/` |
| 4 | 侧栏 P0 项 | 开始构建 / 我的项目(+文件夹) / 社区 / 文档 / 更新日志 / 用户菜单 |
| 5 | AppShell 挂载 | **仅** `/projects` + **已登录**的 `/community` |
| 6 | 未登录 `/community` | 精简顶栏，**无侧栏** |
| 7 | 营销页激进程度 | **大收敛**（去 Stats、去 6 能力卡；三步故事 + Community 发现） |
| 8 | `HeroVisual` | **下移到三步故事**；首屏不出现 |
| 9 | Community 发现取数 | 现有 `/api/community/projects` **最新 N 条**（6–8）；无精选字段 |
| 10 | 测试链 | `/llm-test`、`/test-image` **对外导航隐藏**（路由可留） |
| 11 | 页底收尾 | **精简 Prompt + 旁路链**（文档 / 工作台） |
| 12 | 8 节点流水线 | 三步为主；**折叠「查看工程流水线」** 再展 `AgentFlowDemo` |
| 13 | 差异化卖点 | **嵌进三步文案**，不单独成段、不要能力卡 |
| 14 | 营销顶栏 | Logo · 社区 · 文档 · 更新日志 · 登录 /（已登录）进入工作台 + 头像 |
| 15 | `/projects` Prompt | **完整 `HeroPrompt`**（不砍 chips/skills） |
| 16 | 交付顺序 | **先侧栏壳 + `/projects` Prompt**，再改营销 `/` |

---

## 1. 目标

1. **创建更快被看见**：首屏以 Prompt 为唯一主任务（对齐 Lovable Prompt-first，保留 Open-OX 工程差异化文案）。
2. **产品壳更像产品**：已登录在 `/projects`、`/community` 使用左侧边栏，不再只靠顶栏堆链接。
3. **发现面接上 Community**：营销页用真实 Community 列表占「Discover」槽。

成功标准（可验收）：

- [ ] 未登录打开 `/`，首屏无需滚动即可完成「输入描述 → 开始构建」心智。
- [ ] 已登录在 `/projects`、`/community` 看到同一套可折叠侧栏；切换不依赖顶栏中心链接。
- [ ] 未登录打开 `/community` 仍为精简顶栏、无 AppSidebar。
- [ ] 营销页对外 ≤3 步用户故事；8 节点仅折叠展开可见。
- [ ] `/projects` 顶置完整 `HeroPrompt`；侧栏「开始构建」聚焦该区域。
- [ ] 对外导航无 `/llm-test`、`/test-image`。
- [ ] Studio、Auth、Admin 行为不变（本轮不改）。

---

## 2. 现状问题（简）

| 面 | 现状 | 问题 |
|----|------|------|
| `/` | Hero + Visual + Stats + 8 节点拓扑 + 6 能力卡 + CTA | 工程叙事过重，发现面弱 |
| `/projects` | 全宽网格 + 全局顶栏 | 无侧栏；与「工作台」心智不符 |
| `/community` | 全宽 gallery + 顶栏 | 已登录无统一 app chrome |
| 侧栏 | 仅 Docs / Admin | 主产品路径没有可复用 AppSidebar |

---

## 3. 信息架构（目标）

### 3.1 两层壳

```
匿名 / 营销                         已登录 / 应用
─────────────────────               ─────────────────────────────
/  营销首页（精简顶栏）              AppShell + Sidebar
/community  精简顶栏（无侧栏）         ├ Logo → /projects
/docs、/changelog  现有布局            ├ 开始构建 → 聚焦 /projects Prompt
                                     ├ 我的项目 → /projects (+ folders)
                                     ├ 社区 → /community
                                     ├ 文档 → /docs（链出，不进壳）
                                     ├ 更新日志 → /changelog（链出）
                                     └ 用户菜单
                                   Studio / Auth / Admin 不变
```

### 3.2 侧边栏 IA（P0）

| 区块 | 项 | 行为 |
|------|----|------|
| 品牌 | OPEN-OX | → `/projects` |
| 主导航 | 开始构建 | 在 `/projects` 时聚焦顶置 `HeroPrompt`；若在 `/community` 则先导航到 `/projects` 再聚焦 |
| | 我的项目 | `/projects`；可展开文件夹（现有 folder API + `?folder=`） |
| | 社区 | `/community` |
| 次导航 | 文档 | `/docs`（离开 AppShell，用现有 Docs 布局） |
| | 更新日志 | `/changelog` |
| 底部 | 用户头像菜单 | 对齐现 `UserMenuDropdown`（资料/退出等） |
| 折叠 | 图标轨 | 顶按钮或 `Cmd/Ctrl+B`；移动端 Drawer；`localStorage` 持久化 |

**刻意不做（P0）**：Starred、Shared with me、Recents、Connectors、Upgrade、Inbox、多 Workspace。

**P1（可选）**：Recents；侧栏内新建文件夹。

### 3.3 顶栏策略

| 路由 / 状态 | Chrome |
|-------------|--------|
| `/` | 精简顶栏：Logo · 社区 · 文档 · 更新日志 · 登录 **或** 进入工作台 + 头像 |
| `/community` 未登录 | 同上精简顶栏（无 AppShell） |
| `/projects`；`/community` 已登录 | **隐藏**全局 `Navigation` + Footer（与壳一致）；由 AppSidebar 承担 |
| `/docs/*`、`/changelog` | 维持现有（Docs 自有 DocsSidebar）；从侧栏链入 |
| `/studio/*`、`/auth`、`/admin/*` | 不变 |
| 测试页 | 路由可保留；**任何对外 nav/footer/侧栏均不链出** |

---

## 4. 营销首页改版需求（`/`）— Phase 1

### 4.1 区块顺序（已锁定）

| # | 区块 | 要求 |
|---|------|------|
| A | **Hero Prompt-first** | 短标题 + 一句副文 + `HeroPrompt`；首屏无 Stats、无能力卡、无 `HeroVisual` |
| B | **三步故事** | 描述想法 → 流水线生成可运行站点 → Studio 迭代上线；**差异化文案写在这里**；`HeroVisual` 作为本段示意 |
| B′ | **折叠流水线** | 「查看工程流水线」展开后显示 `AgentFlowDemo`（默认收起） |
| C | **发现：Community** | 「发现社区作品」+ 6–8 卡 +「查看全部 → `/community`」；`GET /api/community/projects` |
| D | **收尾** | 精简版 Prompt + 旁路链：文档、（已登录）进入工作台 /（未登录可省略工作台） |
| E | **Footer** | 产品 / 资源 / 社区；去掉测试页与无效 Studio 裸链（若仍指向无入口） |

**明确删除**：Stats 条、6 张 Capabilities 卡、首屏级 8 节点占位、独立「差异化」大段。

### 4.2 文案方向

- 避免唯一卖点写成「chat with AI」。
- 主句方向：**描述想法 → 得到可运行、可验证、可继续改的站点**（Harness / production engine）。
- 英文短标题可保留品牌感；中文副文讲清交付物。

### 4.3 登录用户与 `/`

- `/` **始终**可访问营销页（不自动 `replace` 到 `/projects`）。
- 已登录顶栏 CTA：**进入工作台** → `/projects`。
- 应用壳内 Logo → `/projects`；营销顶栏 Logo → `/`。

---

## 5. AppSidebar 交互与布局（Phase 0）

### 5.1 布局

```
┌──────── Sidebar (≈240px / collapsed 图标轨) ─┬──────── Main ────────┐
│ Logo → /projects                             │ 顶置完整 HeroPrompt   │
│ 开始构建                                     │ （仅 /projects）       │
│ 我的项目 ▸                                   │                        │
│   └ folders…                                 │  projects grid 或      │
│ 社区                                         │  community gallery     │
│ 文档 · 更新日志                              │                        │
│ …                                            │                        │
│ [Avatar]                                     │                        │
└──────────────────────────────────────────────┴────────────────────────┘
```

### 5.2 行为

- 桌面默认展开；折叠状态 `localStorage`。
- 移动默认隐藏；汉堡打开 Drawer。
- 当前路由高亮；`?folder=` 行为保持。
- Studio 返回继续 `appBack` / `captureAppReturnTo`。

### 5.3 实现约束

- 组件：`app/components/AppShell.tsx` + `AppSidebar.tsx`。
- `/projects`：始终 AppShell（本页已要求登录）。
- `/community`：仅 `authUser` 存在时包 AppShell；否则沿用精简顶栏布局。
- 扩展 `ConditionalNav` / `ConditionalFooter`：已登录的 `/projects`、`/community` 隐藏全局顶栏与 Footer。
- 视觉：延续 dark + primary（橙）；参考 `AdminShell` 密度，**不**抄 Lovable 视觉皮。
- 无障碍：折叠图标 `aria-label`；键盘可聚焦。

---

## 6. 分阶段（已锁定顺序）

### Phase 0 — AppShell + Workspace 创建（先做）

1. `AppShell` + `AppSidebar`（§3.2 / §5）。
2. 挂到 `/projects`；已登录挂到 `/community`。
3. `/projects` 顶置**完整** `HeroPrompt`；侧栏「开始构建」聚焦之。
4. 隐藏上述状态下的全局 `Navigation` / Footer；用户菜单迁侧栏底。
5. 侧栏文件夹展开；对外去掉测试链。
6. 营销顶栏先按 §3.3 精简（可与壳同 PR，但 `/` 大改版属 Phase 1）。

### Phase 1 — 营销 `/` 大收敛

1. 按 §4.1 重排区块；`HeroVisual` 迁入三步；`AgentFlowDemo` 折叠。
2. Community 发现网格（最新 N 条）。
3. 收尾精简 Prompt + 旁路链；Footer 清理。

### Phase 2+（非本确认范围）

- Recents、精选 Community、Docs 并入 AppShell 等。

---

## 7. 开放问题

**无。** 原 §7 四问已在 grilling 关闭（见 §0）。

文案微词（三步具体标题、Hero 英文句）实现时可再调，不阻塞工程开工。

---

## 8. 参考

- 调研：`docs/research/lovable-homepage-app-shell-20260710.md`
- 补充观察：`.scratch/homepage-redesign/lovable-homepage-research.md`
- Lovable 首页：[https://lovable.dev/](https://lovable.dev/)
- Lovable Dashboard 侧栏：[https://docs.lovable.dev/introduction/dashboard-overview](https://docs.lovable.dev/introduction/dashboard-overview)
- 术语：`CONTEXT.md`（Workspace / Community / Publish Preview）
- 现状：`app/page.tsx`、`app/projects/page.tsx`、`app/community/page.tsx`、`app/components/Navigation.tsx`
