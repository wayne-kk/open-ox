# 调研：Lovable 工作区项目列表、社区可见性、发布与 Remix（2026-07-09）

**状态**：完成（基于第一方公开材料；产品 UX 以当前 docs 为准，历史社区形态以博文/changelog 交叉核对）  
**日期**：2026-07-09  
**问题**：Lovable 如何组织工作区项目列表、区分工作区 vs 社区可见性、把项目「发布」到社区/公网、预览他人项目、以及 remix 进自己的工作区？Open-OX 若做 gallery / publish / remix 应学什么、刻意不抄什么？

**范围说明**：本笔记只覆盖 **项目列表 / 可见性 / 发布 / 预览 / remix / 模板**。不展开 Visual Edits、Cloud 计费等（见 `docs/research/lovable-visual-edits-localization-20260709.md`）。

---

## 1. 结论摘要

| 缝 | Lovable（2026-07 公开材料） | 对 Open-OX 的含义（选项，非终裁） |
|----|------------------------------|----------------------------------|
| **工作区项目列表** | Dashboard 侧栏：All / Starred / Created by me / Shared with me；列表可搜、滤（visibility / publish / creator）、排序、grid/list | 工作区列表是 **私有协作面**，不是社区 gallery |
| **可见性模型** | 两套独立开关：**Project access**（编辑器/源码/聊天）vs **Website access**（已发布 URL） | 必须拆「能改源码」与「能看线上站」；勿用一个 Public 混为一谈 |
| **「社区公开项目」** | **Public project visibility 已移除**（changelog：自 2026-04-22）；默认 workspace；跨用户复制靠 **Enable public remixing** 显式 opt-in | 不要假设「发布 = 源码进社区」；社区发现与源码开放应分轨 |
| **发布 Publish** | 部署快照到 `*.lovable.app`（或自定义域）；**不**开放编辑器/源码、**不**自动可 remix | Publish = 托管站点；Remix = 另开开关 |
| **预览他人** | Preview link：7 天、免登录、只看运行中的 app（无编辑器/聊天/源码）；Published URL：永久站点访问 | 「看别人的站」≠「进别人的工程」 |
| **Remix** | 术语固定为 **Remix**（非 fork/clone）；复制 **最新版本** 到目标 workspace；remixer 成为新项目 owner；可看源码 | 复制边界要写清：是否含聊天、密钥、后端连接 |
| **模板分层** | **Lovable templates**（`lovable.dev/templates` 策展）vs **Workspace design templates**（Business/Enterprise）vs 用户 **public remixing** | 策展模板 ≠ 用户社区项目；产品文案勿混用 |

**一句话**：Lovable 已从「默认公开、全站可逛可 remix」迁到 **工作区私有默认 + 发布站点与源码访问解耦 + 显式 public remixing**；对外发现面主要是 **策展模板页 / 个人 profile /（历史）Launched**，而不是「所有用户项目的开放 gallery」。

---

## 2. 工作区项目列表：用户看到什么

### 2.1 Dashboard 与侧栏分组

Dashboard 是创建/打开项目、进 workspace settings 的主页。侧栏 Projects 分组：

| 分组 | 含义 |
|------|------|
| **All projects** | 完整项目列表；可展开看 folder 树 |
| **Starred** | 用户标星的快捷入口 |
| **Created by me** | 自己拥有的项目 |
| **Shared with me** | 他人分享给自己的项目/文件夹 |
| **Recents** | 按最近访问排序 |

另有：workspace 切换器；**Search**（`Cmd/Ctrl+K` 命令面板）；**Resources**（「Browse templates to remix…」）；用户菜单里的 **Profile**、**Community**（指向 Lovable community，docs 语境多为 Discord 等支持社区）。

来源：

- https://docs.lovable.dev/introduction/dashboard-overview
- https://docs.lovable.dev/introduction/getting-started

### 2.2 列表能力：搜索、过滤、排序、视图

- 列表 **无限滚动**。
- **Search**：按项目名过滤；dashboard tabs 上的 Search 可跨所有列表；也可按 **owner** 过滤。
- **Filter**：
  - **Visibility**：Any / Workspace / Restricted
  - **Publish status**：Any / All published / Internally published / Externally published / Not published
  - **Creator**：某 workspace 成员或 All creators
- **Sort**：Last edited / Last viewed / Created / Name / Popularity（已发布 app 近 24h/7d/30d 访客）/ Relevance（有搜索词时）
- **Display**：Grid（默认，卡片+缩略图）或 List；偏好存浏览器。
- 过滤/排序/搜索状态会进 **URL**，便于分享同一 dashboard 视图。

来源：https://docs.lovable.dev/introduction/project-search-and-find

### 2.3 文件夹与所有权边界

- Folders 出现在 All projects、Projects 页、命令面板；最多嵌套 **3** 层。
- Folder visibility：**workspace** 或 **personal**（personal 仅 Business/Enterprise）。
- 项目加入 folder（或改 folder visibility）时，**项目 access 会跟 folder 对齐**（personal → Restricted；workspace folder → 全 workspace 可访问）；移除 folder **不**自动改回 visibility。
- 一个项目同时只能在一个 folder。
- Workspace owners/admins/editors 可管 folders；Viewers 只读；**Collaborators 无 folder 访问**。
- 被分享的 personal folder 会出现在 **Shared with me**。

来源：https://docs.lovable.dev/introduction/project-folders

### 2.4 所有权与角色（列表语境）

- 每个 **Project** 属于某个 **Workspace**；有 project owner。
- Owner 可在 project settings **transfer** 给其他 workspace 成员；owner 离开 workspace 时 ownership 自动转给最资深剩余成员（owners → admins → editors）。
- **Workspace owners**（及 docs 多处强调）对 workspace 内 **所有** 项目有完整查看/编辑权，即使项目设为 Restricted。
- 非 owner 若要个人副本：docs 明确建议 **remix 到自己的 account**，新副本的 owner 是自己。

来源：

- https://docs.lovable.dev/features/share-project
- https://docs.lovable.dev/glossary （Workspace / Project / Project access）
- https://docs.lovable.dev/features/collaboration

---

## 3. 可见性模型：Workspace vs「社区」——先拆两轴

### 3.1 Project access（编辑器侧）≠ Website access（站点侧）

Docs 反复强调两套 **独立** 设置：

| 轴 | 控制什么 | 典型选项 |
|----|----------|----------|
| **Project access**（曾称 project visibility） | 谁能进编辑器：源码、chat history、WIP、未发布变更；以及谁能 remix/协作 | **Workspace**（默认，全计划）/ **Restricted**（Business/Enterprise：仅 owner + 显式邀请） |
| **Website access** | 谁能访问 **已发布** 的 live URL | Free/Pro：实质为公开链接；Business/Enterprise：**Anyone** 或 **Workspace**（可细到人/组） |

关键提醒（docs 原文要点）：**Publishing 不改变编辑器访问**；**改 project access 不影响已发布站点访客**。

来源：

- https://docs.lovable.dev/features/project-visibility
- https://docs.lovable.dev/features/publish
- https://lovable.dev/blog/our-response-to-the-april-2026-incident （产品侧同一区分的官方说明）

### 3.2 默认与历史：Public 项目已死

时间线（docs + 事故博文交叉）：

| 时期 | 行为 |
|------|------|
| 早期 | Public/Private；免费默认 Public；Public = 开放工程（含源码与 chat）、可 remix、展示在 profile |
| 2025-03 起 | 逐步收紧：API/remix 不再暴露 public 项目 chat 等 |
| 2025-11-06 | 新项目默认 **workspace**；各计划可改已有项目 |
| 2025-12 | 所有 workspace 默认 project access = workspace |
| **2026-04-22** | **不能再创建 public projects**；Public visibility **完全移除**；存量 public → workspace；跨用户复制改为 **Enable public remixing** |

Changelog 原文要点：*「Public project visibility has been removed… To let others copy and remix your project, go to Project settings and turn on Enable public remixing.」*

来源：

- https://docs.lovable.dev/features/project-visibility
- https://docs.lovable.dev/changelog
- https://lovable.dev/blog/our-response-to-the-april-2026-incident

### 3.3 Workspace 内「共享」≠ 对全网社区开放

Share dialog（项目顶栏 **Share**）：

- 邀请 workspace 成员 / groups（Business+）/ **external collaborators**
- 角色：Viewer / Editor / Admin（计划相关）
- Workspace 行：Can edit / Can view / No access（Restricted）——Free/Pro 上项目 **始终对 workspace 可见**，只能调个人协作者级别
- **Invite link**：打开即成为协作者；**5 天**过期；同时仅一条有效
- 被邀请且已有账号的项目会出现在对方 **Shared with me**

Workspace 级还有 **Workspace discovery**（Business/Enterprise）：同 verified domain 用户可发现并请求加入 workspace——这是 **组织发现**，不是 app gallery。

来源：

- https://docs.lovable.dev/features/share-project
- https://docs.lovable.dev/features/privacy-and-security-settings
- https://docs.lovable.dev/features/collaboration

---

## 4. 社区 / gallery / explore 表面（命名与现状）

公开材料里「社区」一词混用多种表面，需分开记：

### 4.1 策展模板（当前主发现面）

| 表面 | 命名/文案 | 内容 |
|------|-----------|------|
| 营销页 | `lovable.dev/templates`、`lovable.dev/projects/featured` | 标题 *「Website and app templates Built with AI」*；副文案 *「Production-ready apps from the Lovable community」*；按 Apps / Websites / Portfolio 等类目展示卡片 |
| Dashboard | 侧栏 **Resources**；Quick start「curated selection」 | 「Browse templates to remix and build your next project」 |
| Changelog | **Lovable templates** vs **Workspace templates** | 策展模板 vs 本 workspace 的 design templates |

2026-04 事故博文：历史上 public 用户项目被批量改私有时，**例外保留「official remixable templates on lovable.dev」**。

来源：

- https://lovable.dev/templates
- https://lovable.dev/projects/featured （拉取内容与 templates 页同构）
- https://docs.lovable.dev/introduction/dashboard-overview
- https://docs.lovable.dev/changelog
- https://lovable.dev/blog/our-response-to-the-april-2026-incident
- https://lovable.dev/blog/2025-01-13-kickstart-your-builds-with-templates-feedback-portal-and-more （早期 templates 页公告）

### 4.2 用户 Profile

- URL：`lovable.dev/@<username>`
- 可设 name、bio、location、website、avatar、banner；username 唯一
- **Profile visibility**：Public（默认，非 Enterprise）或 Private（仅本人 + workspace owners/admins；Enterprise 默认 Private）
- Changelog：新 profile「lay the groundwork for future community and publishing features」；早期事故博文称 public 项目曾 showcase 在 profile

**缺口**：当前 account-settings docs **未**写清 public profile 上是否仍列出可 remix 项目、列表过滤规则、或与 Enable public remixing 的联动。

来源：

- https://docs.lovable.dev/introduction/lovable-account-settings
- https://docs.lovable.dev/changelog
- https://lovable.dev/blog/our-response-to-the-april-2026-incident

### 4.3 Dashboard「Discover apps from the community」

Changelog「A more Lovable dashboard」条目列出能力含 **Discover apps from the community**，并曾有「categorization to community projects」「featured projects on the homepage」等历史条目。

**缺口**：当前 `llms.txt` / dashboard-overview **没有**独立「Community gallery」产品页文档；公开 HTML 可抓到的发现页主要是 **templates/featured**。是否仍有登录后 dashboard 内的社区 feed、过滤器命名、排序规则——第一方 docs **沉默**。

来源：https://docs.lovable.dev/changelog

### 4.4 Lovable Launched（历史流量/投票面）

2025-01 博文宣布 **Lovable Launched**：类似 Product Hunt，提交 app、投票、曝光；与「发布到 `lovable.app`」是不同动作。

2026-07-09 拉取 `https://launched.lovable.app` → **404**。当前 docs index **无** Launched 专页。应视为 **历史/状态不明** 的第一方表面，不能当作现行产品路径。

来源：

- https://lovable.dev/blog/2025-01-30-how-to-launch-and-get-traffic-to-an-app-built-with-lovable
- （拉取失败）https://launched.lovable.app

### 4.5 「Community」作为支持渠道

Support policy：所有计划可用 **Discord** community support；用户菜单有 Community 入口。这与「项目 gallery」不是同一产品对象。

来源：

- https://docs.lovable.dev/introduction/support-policy
- https://docs.lovable.dev/introduction/dashboard-overview

---

## 5. Publish / Share /「公开」流程

### 5.1 Publish = 部署站点快照

- 顶栏 Publish → 配置 URL / website access / metadata → 部署 **当前版本快照** 到可分享 URL。
- 默认形态：`[subdomain].lovable.app`；可改 subdomain；付费可加 custom domain；Business/Enterprise 可有 branded `app-name.workspace-subdomain.lovable.app`。
- 后续改动需 **Publish → Update**；有未发布变更时 Publish 按钮上有小圆点。
- 可从 chat 让 agent publish（尊重 workspace 权限与安全检查；默认需批准）。
- Unpublish：live URL 失效，编辑器内项目仍在。

**明确否定**（FAQ/Publish docs）：

- Publish **不会**把编辑器/源码开放给所有人  
- Publish **不会**自动使项目可 remix  

来源：https://docs.lovable.dev/features/publish

### 5.2 Website access（发布后谁能打开站）

| 计划 | 选项 |
|------|------|
| Free / Pro | 有链接即可访问（外部发布）；不能限制为仅 workspace |
| Business / Enterprise | **Anyone** 或 **Workspace**（可整 workspace 或指定人/组）；按钮文案可为 *Publish to workspace* |

Workspace 可设 **Default website access**；Enterprise 可限制谁能 **external publish**。

来源：

- https://docs.lovable.dev/features/publish
- https://docs.lovable.dev/features/privacy-and-security-settings

### 5.3 Share 里与「给别人看」相关的三条路径

| 机制 | 给对方什么 | 登录？ | 时效 | 源码/编辑器？ |
|------|------------|--------|------|----------------|
| **Invite / invite link** | 项目协作者（Viewer/Editor/…） | 需要 Lovable 账号 | Invite link 5 天 | 是（按角色） |
| **Share preview** | 运行中 app 的只读预览 | 否 | **7 天** | **否** |
| **Publish** | 永久（或直至 unpublish）站点 URL | 视 website access | 持久 | **否**（仅站点） |

Preview vs Publish：docs FAQ——preview 可在 **未 publish** 时分享；publish 有独立 website access。

Guest comments：preview 默认可开；访客可钉评论；owner 收 inbox。

Enterprise 可关 **Allow public preview links sharing**。

来源：https://docs.lovable.dev/features/share-project

### 5.4 Enable public remixing（跨用户「社区复制」开关）

- 位置：**Project settings → Enable public remixing**
- 效果：任何持有 **project link** 的人可 **copy and remix**；可随时关闭
- Remix 始终拿 **latest version**；不能改原项目；原项目不变
- Remixer **可以查看源码** → docs 警告勿含密码/API keys/个人数据
- **不等于** Publish；也不等于恢复旧的「Public project visibility」

账号迁移 FAQ 仍用该开关：临时开启 → 新账号打开 URL → Remix → 再关。

来源：

- https://docs.lovable.dev/features/project-visibility
- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/changelog

---

## 6. 预览他人项目：只读？活站？源码？

分场景：

| 场景 | 看到什么 | 源码 | 编辑器/Chat |
|------|----------|------|-------------|
| **Published URL**（Anyone） | 线上 web app | 否 | 否 |
| **Published URL**（Workspace-only） | 仅认证 workspace 成员可见的内部站 | 否 | 否 |
| **Preview link** | 当前预览运行态；可评论（若开启） | 否 | 否 |
| **Invite 为 Viewer** | 编辑器只读 | 按 Viewer 权限（可见工程，不可编辑） | 可见，不可改 |
| **持有可 remix 的 project link** | 可发起 Remix；docs 称 remix 时可看源码 | 是（remix 路径） | 非「编辑原项目」 |
| **无权限打开 private/restricted 项目** | 可 **request** viewer/editor access | 否（直至批准） | 否 |

Viewer 仍可 **Remix project**（协作权限表：Viewer 行 Remix = Yes）——即「只读协作」仍允许复制到自己名下。

来源：

- https://docs.lovable.dev/features/share-project
- https://docs.lovable.dev/features/publish
- https://docs.lovable.dev/features/collaboration
- https://docs.lovable.dev/introduction/faq （request access）
- https://docs.lovable.dev/features/project-visibility

**历史对照**：事故博文称早期 remix public 项目会带上 **完整 chat history + 源码**；2025-03 起刻意去掉 chat 经 remix/API 暴露。当前 docs 只明确 remix 暴露 **source code**，**未**再承诺暴露 chat history。

来源：https://lovable.dev/blog/our-response-to-the-april-2026-incident

---

## 7. Remix /「Fork」进自己的工作区

### 7.1 术语

- 产品与 glossary 统一用 **Remix**；FAQ 标题写 *「How do I copy (remix) a project?」*——**copy = remix**，不用 fork/clone 作主术语。
- Glossary：*「Reuse the current state of a project as the starting point for a new one… copy you can edit independently while preserving the original.」*

来源：

- https://docs.lovable.dev/glossary
- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/introduction/getting-started

### 7.2 谁可以 remix

可 remix：

1. **Enable public remixing** 的他人项目（持 link）  
2. **自己的**项目  
3. **有 access** 的项目（workspace/邀请）

限制（第一方写明）：

- 他人项目若 **连接 Supabase** → **不能** remix（须先 disconnect）  
- Changelog：连接 **Shopify** 的项目不能 remix（须 disconnect）  
- Enterprise：**Editor project transfers** 可禁止 editors 把自有项目 **transfer/remix 到另一 workspace**（同 workspace 内 remix 不受影响）；owners/admins 另有例外规则  

来源：

- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/introduction/getting-started
- https://docs.lovable.dev/changelog
- https://docs.lovable.dev/features/privacy-and-security-settings

### 7.3 操作与产物

- 入口：FAQ/Quick start → **Project Settings → Remix**；changelog 描述 remix dialog（进度 checklist、可命名、可选目标 workspace/folder、后台进行 + 通知）
- 结果：**exact copy** 进入 **当前选中的 workspace**（后支持选目标 workspace/folder）；可独立编辑
- 非原 owner remix 后：**你是新副本的 owner**
- 账号迁移注：*「Remixed projects won’t carry over subscription-level features unless the new workspace has them too.」*
- Changelog：曾支持 remix 带 **custom secrets** 的项目；有「为何不能 remix」的错误说明

来源：

- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/features/share-project
- https://docs.lovable.dev/changelog

### 7.4 复制内容边界（已知 / 未知）

| 内容 | 第一方说法 |
|------|------------|
| 项目「当前状态」/ latest version | 是（exact copy / latest） |
| 源码 | Remix 路径下可查看；副本可编辑 |
| Chat history | 事故博文：曾随 public remix 暴露，后移除；**现行 docs 未写 remix 是否复制 chat** |
| Supabase / Shopify 连接 | 连接态会 **阻止** remix；非「复制连接」 |
| Secrets | Changelog 称支持带 custom secrets 的 remix（细节未展开） |
| Attribution（署名原作者） | **公开 docs/terms 未描述** remix 署名 UI 或强制 license |
| 法律所有权 | Terms：用户拥有自己的 Customer Data / AI Output；**未**单独规定「remix 他人项目」的许可条款 |

来源：

- https://docs.lovable.dev/features/project-visibility
- https://docs.lovable.dev/introduction/faq
- https://docs.lovable.dev/changelog
- https://lovable.dev/blog/our-response-to-the-april-2026-incident
- https://lovable.dev/terms
- https://lovable.dev/product-terms

---

## 8. 模板 vs 社区项目 vs Design templates

| 类型 | 受众 | 机制 | 复制什么 |
|------|------|------|----------|
| **Lovable templates**（策展） | 全站 | `lovable.dev/templates` / Resources；官方可 remix 模板（事故后仍保留） | 作为新项目起点（产品层「remix templates」） |
| **User project + public remixing** | 持 link 的任何人 | Project settings 开关 | Latest 工程副本；可看源码 |
| **Design templates**（Business/Enterprise） | 本 workspace | Project settings **Use as a template**；创建时 `+` → Design → Use a template；可设 default | **完整 codebase**：结构、组件、样式、配置、scaffolding；新项目独立可改 |
| **Design systems**（Enterprise） | 本 workspace | 另产品线（组件库连接/更新） | 非本笔记重点 |

Design templates 前提 docs 仍写 *「template project must have public or workspace visibility」*——在 Public visibility 已移除后，**「public」措辞可能过时**；以 workspace + Use as template 流程为准。

Dashboard changelog：UI 上区分 **Lovable templates** 与 **Workspace templates**。

来源：

- https://docs.lovable.dev/features/business/design-templates
- https://docs.lovable.dev/glossary
- https://docs.lovable.dev/changelog
- https://lovable.dev/templates
- https://lovable.dev/blog/our-response-to-the-april-2026-incident

---

## 9. 许可、限制与「社区发布」相关法律文案

- **Terms / Product Terms**：用户拥有其构建的 apps/projects（Customer Data）及为其生成的 AI Output（受第三方模型权利约束）；Lovable 拥有平台与 Lovable Materials（定义中含其提供的 **templates** 等）。
- **未找到**第一方条款明确：开启 public remixing = 授予全世界何种 license、是否要求 attribution、remix 后再分发的限制。
- Remix 产品限制以 **功能门闩** 为主（Supabase/Shopify、Enterprise transfer 策略），而非 SPDX 式 license 选择器。
- 安全警告是产品层主叙事：remix 暴露源码 → 勿放密钥。

来源：

- https://lovable.dev/terms
- https://lovable.dev/product-terms
- https://docs.lovable.dev/features/project-visibility

---

## 10. 对 Open-OX 的含义（选项，非终裁）

1. **拆三轴**：工作区列表可见性 / 已发布站点访问 / 「允许他人复制工程」——对齐 Lovable 的 project access × website access × public remixing，避免单一 Public。  
2. **Publish ≠ 进社区源码库**：托管预览/生产 URL 与 gallery/remix 分轨。  
3. **预览分层**：免登录只读 live/preview vs 登录只读工程 vs remix 副本——分别对应 Share preview / Viewer / Remix。  
4. **发现面**：若做社区，明确是 **策展模板**、**用户 opt-in remix 目录**，还是 **发布站点目录**；Lovable 当前公开材料偏前两者（且用户目录文档不全）。  
5. **Remix 契约写死**：复制是否含聊天、密钥、后端、attribution——Lovable 在此留白，Open-OX 应产品化写清。

---

## 11. Gaps / unknowns（第一方沉默或矛盾处）

1. **登录后 dashboard「Discover apps from the community」** 的现行 UI、过滤器、排序、与 public remixing 的入选规则——changelog 有、专页 docs 无。  
2. **Public profile** 上是否展示项目列表、展示条件（仅 published？仅 remixable？）——account settings 未写。  
3. **Remix 是否复制 chat history / knowledge / analytics / GitHub 连接**——现行 docs 未列清单。  
4. **Attribution / license**——无 remix 专用许可文案。  
5. **Lovable Launched** 是否仍运营——博文存在，`launched.lovable.app` 2026-07-09 为 404。  
6. **Design templates** docs 仍提「public … visibility」——与「Public 已移除」并存，以哪份为准未说明。  
7. **持 project link + public remixing** 时，未 remix 前能否在编辑器里浏览源码，还是仅在 remix 流程中暴露——docs 只说 *「when they remix it」*。  
8. **「Community」用户菜单** 具体落地 URL（Discord vs 站内）——dashboard-overview 未展开。  
9. **API**：FAQ 的 Build with URL 是「从链接生成 app」，不是社区 gallery API；未见公开「列出社区项目」API。

---

## 12. 主要来源

| 类型 | URL |
|------|-----|
| Project access | https://docs.lovable.dev/features/project-visibility |
| Share / preview / invite | https://docs.lovable.dev/features/share-project |
| Publish / website access | https://docs.lovable.dev/features/publish |
| Dashboard / 列表导航 | https://docs.lovable.dev/introduction/dashboard-overview |
| 搜索过滤排序 | https://docs.lovable.dev/introduction/project-search-and-find |
| Folders | https://docs.lovable.dev/introduction/project-folders |
| Quick start / Remix 入门 | https://docs.lovable.dev/introduction/getting-started |
| FAQ（remix / 迁移） | https://docs.lovable.dev/introduction/faq |
| Glossary（Remix / templates） | https://docs.lovable.dev/glossary |
| Collaboration 权限表 | https://docs.lovable.dev/features/collaboration |
| Privacy & security（discovery / transfer） | https://docs.lovable.dev/features/privacy-and-security-settings |
| Design templates | https://docs.lovable.dev/features/business/design-templates |
| Account / profile | https://docs.lovable.dev/introduction/lovable-account-settings |
| Support / Discord community | https://docs.lovable.dev/introduction/support-policy |
| Changelog | https://docs.lovable.dev/changelog |
| Docs index | https://docs.lovable.dev/llms.txt |
| 事故与可见性重构博文 | https://lovable.dev/blog/our-response-to-the-april-2026-incident |
| Templates 营销页 | https://lovable.dev/templates |
| Featured（与 templates 同构） | https://lovable.dev/projects/featured |
| Templates 早期公告 | https://lovable.dev/blog/2025-01-13-kickstart-your-builds-with-templates-feedback-portal-and-more |
| Lovable Launched 公告 | https://lovable.dev/blog/2025-01-30-how-to-launch-and-get-traffic-to-an-app-built-with-lovable |
| Terms | https://lovable.dev/terms |
| Product Terms | https://lovable.dev/product-terms |

---

## 13. Open questions / unknowns（清单复述）

见 **§11**。核心未知：现行社区发现 UI、profile 项目展示规则、remix 复制清单与许可/署名、Launched 存续、未 remix 前的源码可见范围。
