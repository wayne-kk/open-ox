# 调研：Lovable 修改历史 / 版本时间线 / 回滚 UX（2026-07-10）

**状态**：完成（基于第一方公开材料：docs + blog + changelog；**未登录**产品编辑器，故 UI 细节以文档/公告为准，不臆造）  
**日期**：2026-07-10  
**问题**：Lovable 如何呈现项目编辑/版本历史、预览与回滚？Open-OX 功能 3.3「时光机式修改历史」（本 sprint：缩略图 + 意图一行；回滚延后）应学什么、刻意不抄什么？

**范围说明**：本笔记覆盖 **项目代码/编辑历史（History / Versions / Revert）**、与 **聊天 transcript 的关系**、**Bookmarks/Pin 检查点**、以及与之相邻但不同的 **Cloud 数据库备份恢复**。不展开 Visual Edits / Preview toolbar（见 `lovable-visual-edits-localization-20260709.md`）、Publish/Remix 主路径（见 `lovable-community-publish-remix-20260709.md`）。

**Open-OX 对照基线**：

- 产品想法：`docs/product/ux-expansion-ideas-20260710.md` §3.3  
- 术语：`CONTEXT.md` — **Modify history turn**（instruction + assistantText + touchedFiles + intent…）  
- 本 sprint：UI-first 时间线（缩略图 + 意图一行）；**不做** rollback；稍后对齐 D2 checkpoints

---

## 1. 结论摘要

| 缝 | Lovable（2026-07 第一方材料） | 对 Open-OX 3.3 的含义 |
|----|------------------------------|----------------------|
| **入口** | 聊天上滚 **或** 聊天顶部 **View history** 图标 → History panel | 时间线应是显式入口，不只靠聊天气泡上滚 |
| **单位** | 以 **edit / version**（与聊天回合强绑定）为粒度；「Every edit is a commit」；Bookmark/Pin 标稳定点 | 对齐 Open-OX **Modify history turn**，不要另造「无名快照」单位 |
| **时间线形态** | History panel 按 **日期分组**（自称像 Google Docs）；History / Bookmarks **分 Tab** | 日期分组 + 书签/检查点 Tab 可学；不必抄「Google Docs」文案 |
| **视觉预览** | Changelog：**hover 显示 screenshot preview**；可先 **preview** 再 revert | 本 sprint 的「每步缩略图」比 Lovable 文档更强（Lovable 公开材料偏 hover，非常驻缩略图墙） |
| **意图文案** | 版本有 **descriptive labels**；Git commit message 描述「实际改了什么」 | 一行 intent 可学；优先用户意图，辅以「改了什么」 |
| **回滚模型** | **Preview → Revert**；Restore 已改名 Revert；revert **新建 edit card**（类 git revert）；事后改动仍留在聊天可再应用；另有 Build **undo**（停任务后） | 延后实现，但应预留「非破坏式 revert + 可再应用」语义，勿做成静默 truncate |
| **Chat ↔ History** | **同一产品面族**：聊天内可 revert；History panel 与 chat **对齐展示**；另有 agent 侧 **chat history search** | 时间线与 Studio 对话应同源（Modify history turn），可分视图，勿两套真相 |
| **后端/数据** | 代码 revert **不**自动还原 DB/migration；Cloud 另有 **日备 ~14 天** | 日后 D2 需显式区分「源码检查点」vs「数据备份」 |

**一句话**：Lovable 把版本历史做成 **与聊天回合绑定的、可预览的 edit 时间线**（History panel + 聊天内 Revert + Bookmark），视觉上靠 **hover 截图 + 先 preview 再 revert**，回滚是 **追加式 Revert（新 edit card）** 而非抹掉历史；Open-OX 3.3 应先把 Modify history turn 做成 **常驻缩略图 + 意图一行** 的可摸时间线，回滚语义可后对齐，但不要做成与聊天脱节的第二套历史。

---

## 2. 产品如何呈现 History / Versions

### 2.1 用户入口（docs）

FAQ 明确两种查看方式：

1. **在聊天里向上滚动**  
2. 点击聊天顶部的 **View history** 图标  

选中旧版本后可 **preview**，或 **restore** 到该版本（FAQ 用词；产品侧后来统一为 Revert，见 §4）。

来源：https://docs.lovable.dev/introduction/faq （「How do I see my project history?」）

Quick start 将「Track changes with version history and revert to any previous version」列为项目工作流能力之一，并单独描述 History panel「works like Google Docs」。

来源：https://docs.lovable.dev/introduction/getting-started

### 2.2 History panel 形态（changelog + blog）

| 能力 | 第一方描述 | 来源 |
|------|------------|------|
| 日期分组时间线 | 按日期组织 edits，「just like google docs」 | [Versioning 2.0 博文](https://lovable.dev/blog/versioning-with-lovable-two-point-zero)；changelog「Introducing Versioning 2.0」 |
| History / Bookmarks 分 Tab | 「separate tabs for history and bookmarks」；加载更稳、与 chat 更一致 | [changelog](https://docs.lovable.dev/changelog)（Improvements: History panel with bookmarks） |
| 时间线清理 | 「cleaner timeline prioritizing dates, restored versions now visible, simplified version navigation」 | changelog（Improvements，与 history view 相关条目） |
| 活跃 edit 高亮 | 「Active edit cards are now highlighted」 | changelog |
| 最近 edits 快访 | 「quickly access the last 8 edits」 | [2024-10 博文](https://lovable.dev/blog/2025-01-13-better-version-management-and-speed-enhancements)（页面 slug 含日期，文内 Published October 2, 2024） |
| 描述性标签 | 「descriptive labels to each version」；preview 更易见 | 同上博文 |
| 聊天懒加载 | 大项目消息按需渲染 / 上滚再加载，避免一次加载全部 | 同上博文；changelog（loading larger projects） |

Glossary 定义：

> **History**: The chronological log of changes to your project. Lets you revert to a previous version or bookmark important checkpoints.

来源：https://docs.lovable.dev/glossary

**文档缺口**：`docs.lovable.dev/llms.txt` 的 features 目录中 **没有** 独立的 History / Versions 功能页；能力散落在 FAQ、Quick start、Best practices、Glossary、Changelog。  
截至 2026-07-10，第一方材料 **未** 使用「time machine / 时光机」品牌名。

### 2.3 登录态产品 UI

本调研 **未登录** Lovable 编辑器，无法核验：面板具体布局、缩略图是否常驻、Revert 按钮像素级位置、Bookmark 星标交互等。以下凡属 UI 细节，均来自 docs/changelog/blog 的文字描述；**不以截图臆造**。

---

## 3. 「版本」的单位是什么？

### 3.1 公开材料中的单位

| 说法 | 含义（据第一方措辞） | 来源 |
|------|----------------------|------|
| **edit / version** | 历史条目；可 preview / revert / bookmark | FAQ、Glossary、Versioning 2.0 |
| **chat response / past message** | Revert 挂在「each response」下；也可「edit a past message and revert」 | FAQ |
| **Every edit is a commit** | Best practices：每次 edit 对应一次 commit；用 pinning 标稳定版 | https://docs.lovable.dev/tips-tricks/best-practice |
| **Bookmark / Pin** | 收藏稳定版本，方便出事时回到已知好点；History 与 Bookmarks 分 Tab | Versioning 2.0；Glossary「bookmark important checkpoints」；Best practices「Use pinning… After every working feature: Pin it」 |
| **edit card** | Revert 后 **新建** 一张 edit card（类 git revert），不抹掉后续聊天 | Versioning 2.0「Smarter Restores」 |
| **Commit messages** | 描述「项目实际改了什么」，不只复述用户 prompt，便于浏览 history | changelog「Better commit messages」 |

**推断边界（标注为推断，非 docs 原文）**：公开材料强烈暗示 **一次成功的 AI edit / 聊天回合产出 ≈ 一个 version 条目**，并与 Git commit 对齐；但 **未** 写明「仅 assistant 消息」「仅 apply 成功」「Plan mode 无代码回合是否占位」等精确规则。  
**not found in first-party docs as of 2026-07-10**：version 与 chat message 的 1:1 形式化定义、是否包含失败/空 diff 回合。

### 3.2 与「检查点」的关系

Lovable 的 **checkpoint** 在 Glossary 里通过 **bookmark** 表达（「bookmark important checkpoints」），不是单独的「命名快照」产品对象。Best practices 的 **Pin** 与 Bookmark 同族（标稳定 edit）。

另有一条 **不相关** 的「checkpoint」语义：Plan mode 把最新批准计划写入 `.lovable/plan.md`；旧计划仍在 chat history —— 这是计划文件，不是应用版本时间线。  
来源：https://docs.lovable.dev/features/plan-mode

---

## 4. 预览缩略图 / Screenshot

| 主张 | 证据强度 | 来源 |
|------|----------|------|
| Edit history **hover** 显示 **screenshot previews**，无需打开每个 version 即可看当时 app 长什么样 | 强（changelog 原文） | https://docs.lovable.dev/changelog — 「Edit history now shows screenshot previews on hover…」 |
| Revert 前可 **preview** 旧 working version | 强（FAQ / Quick start） | FAQ；getting-started |
| Preview 能力被做得「更可见」 | 中（产品博文） | https://lovable.dev/blog/2025-01-13-better-version-management-and-speed-enhancements |

**not found in first-party docs as of 2026-07-10**：

- 时间线是否 **常驻** 缩略图网格（vs 仅 hover）  
- 截图分辨率、是否多页、是否只截当前路由  
- 缩略图存储/生成时机（每次 edit 自动截？）

对 Open-OX：功能 3.3 规划的「每步缩略图」是 **比 Lovable 公开文档更显式的 UI**；Lovable 已验证「历史条目需要视觉锚点」，但公开形态偏 **hover preview**，不是「时间机器胶片条」品牌化 UI。

---

## 5. Restore / Undo / Revert 模型（供日后 D2，本 sprint 不做）

### 5.1 术语演进

Changelog：「**Restore** is now **Revert**」。可跳回聊天历史任一点，或 **编辑过去的用户消息再 revert** 探索新方向；原工作仍留在聊天，可随时再应用。

来源：https://docs.lovable.dev/changelog — 「Better reverts and ability to edit and revert your messages」

### 5.2 用户路径（docs）

1. **Preview** 旧 version → 确认 → **Revert**  
2. 或：**Edit past message + revert** 换一条路径  
3. Revert 入口：聊天里 **每条 response 下方**，或 **history tab** 选中 version 后  

FAQ：「Nothing gets lost — all changes made after that point stay in the chat and can be reapplied anytime.」

来源：https://docs.lovable.dev/introduction/faq

### 5.3 Revert 的历史语义（非 destructive truncate）

Versioning 2.0：恢复到旧 edit 时 **创建新的 edit card**，「similar to git revert commits」，便于在 chat history 里追踪。

来源：https://lovable.dev/blog/versioning-with-lovable-two-point-zero

### 5.4 与 Undo 的区分

Build mode：用户 **Stop** 当前任务后，已完成的改动保留；若要去掉，用 **undo button**「revert to the previous state」。

来源：https://docs.lovable.dev/features/agent-mode （FAQ: stop request）

这更像 **刚停的那次 run 的撤销**，不是 History panel 里任意时间点的 Revert。Preview toolbar 文档也提到 inline 等场景有 undo（与 credits 说明并列），属编辑手势级撤销，不是项目版本时间线。

来源：https://docs.lovable.dev/tips-tricks/best-practice （preview toolbar「Quick edits with undo available」）；https://docs.lovable.dev/features/preview-toolbar

### 5.5 代码 revert ≠ 数据 revert

| 场景 | 行为 | 来源 |
|------|------|------|
| Revert 到跑过 migration 之后的过去 edit | Lovable **告知不会 revert Database** | changelog（Lovable 2.0 条目） |
| Supabase 项目 | 「Supabase does not revert cleanly」；schema 可能坏 | best-practice |
| Lovable Cloud DB | 独立 **Backups**：日备，约 **14 天**；「Restore to this backup」；**永久**且丢弃备份后数据 | https://docs.lovable.dev/integrations/cloud |
| Remix + Lovable backend | remixed 项目上 **不能** revert 到旧 app version；纯前端 Cloud 托管则可 | cloud docs FAQ |

调试指南建议：必要时 rollback 几步，并 **告诉 AI 你刚 revert 了**，避免上下文错乱。

来源：https://docs.lovable.dev/prompting/prompting-debugging

### 5.6 核选项：Remix

Best practices：卡住时 Remix 得到干净副本（T=0），旧项目当参考；需先断开 Supabase。

来源：https://docs.lovable.dev/tips-tricks/best-practice

---

## 6. Chat transcript 与 Version history 的关系

```text
[Chat transcript]  ←→  [History panel]
   上滚看过去            View history 图标
   每条 response 下 Revert    History | Bookmarks tabs
   Edit message + revert      选 version → preview / revert
         \                    /
          \                  /
           同一套 edit/version 叙事
                    │
                    ▼
        （Agent）Chat history search — 检索/语义问过去消息
```

| 关系 | 证据 |
|------|------|
| **同一面族，非完全无关的两套系统** | FAQ：聊天上滚 **或** View history；Revert 在 chat **与** history tab 都有 |
| **Panel 与 chat 对齐** | Changelog：History「better matches what you see in chat」 |
| **Revert 写入聊天时间线** | Versioning 2.0：新 edit card 出现在 chat history |
| **Agent 可读全历史** | Changelog「Chat history search」：关键词 + 语义问题（如设计风格） |
| **跨项目引用可读 chat history** | Glossary / agent-mode：cross-project referencing 含 chat history |

**结论**：Lovable 没有把「对话」和「版本」做成互不相关的两个产品；版本是 **可预览、可书签、可 revert 的 edit 层**，UI 上叠在聊天工作流之上。Open-OX 已有 Modify history turn 作为共享语义单位 —— 与 Lovable 同构；3.3 应是 **同一数据的时间线视图**，不是第二份 transcript。

---

## 7. 定价 / 保留期限（仅第一方）

| 对象 | 保留/限制 | 来源 |
|------|-----------|------|
| **项目 edit / version history** | **未找到** 保留天数、条数上限、按套餐差异 | not found in first-party docs as of 2026-07-10 |
| Lovable Cloud **数据库备份** | 约 **14 天** 日备 | cloud docs |
| Enterprise **Audit logs** | 约 **90 天**（13 weeks） | https://docs.lovable.dev/features/audit-logs |
| 已删 **Workspace** | 60 天宽限期可由 support restore | FAQ / changelog |
| 已删 **Project** | FAQ：无法 restore | FAQ |

**不要**把 DB 14 天或 Audit 90 天误写成「项目时光机保留策略」。

---

## 8. 产品演进时间线（第一方公告）

| 大致阶段 | 内容 | 来源 |
|----------|------|------|
| 2024-10 | Descriptive labels；preview 更可见；最近 8 edits；聊天懒加载 | [Better Version Management…](https://lovable.dev/blog/2025-01-13-better-version-management-and-speed-enhancements) |
| ~Versioning 2.0（changelog + 2025-03-03 博文） | Bookmarks；按日分组 history；restore 新建 edit card | [Versioning 2.0](https://lovable.dev/blog/versioning-with-lovable-two-point-zero)；changelog |
| 后续 changelog | Hover screenshot previews；Restore→Revert + edit message；commit message 质量；History/Bookmarks tabs；active edit 高亮；DB 不随代码 revert 的提示 | https://docs.lovable.dev/changelog |
| 当前 docs | FAQ + Quick start + Glossary + Best practices；**无**独立 History feature 页 | docs.lovable.dev |

---

## 9. Open-OX：学什么 / 不抄什么

### 9.1 建议学（Adapt）— 对齐 3.3 本 sprint

1. **显式 History 入口**（不只靠 Studio 聊天气泡上滚）—— 对应 Lovable View history。  
2. **单位 = Modify history turn**（已有语义）—— 对应 Lovable edit/version，勿另造「匿名快照 ID」给用户。  
3. **每条：视觉锚点 + 一行意图** —— Lovable 用 hover 截图 + descriptive labels；Open-OX 本 sprint可把缩略图做成 **常驻**，意图用用户 instruction 压缩/一行摘要。  
4. **日期（或会话）分组** —— 降低长历史噪音（Lovable Google Docs 式分组）。  
5. **先预览、后回滚的心智**（UI 可先做「点选回放预览」，按钮灰掉或标注 Coming soon）—— 对齐 Preview → Revert，避免用户以为点一下就毁档。  
6. **Chat 与 Timeline 同源** —— History panel「matches chat」；Open-OX 时间线应读同一 Modify history turn 源。

### 9.2 建议学（Adapt）— 留给 D2 回滚

1. **追加式 Revert（新 turn / 新 checkpoint 记录）**，而不是 truncate 聊天 —— 对齐「new edit card / git revert」。  
2. **事后改动可再应用** 的产品承诺 —— FAQ「Nothing gets lost」。  
3. **Bookmark/Pin 稳定点** —— 与 D2 checkpoints 对齐；用户可标记「好版本」。  
4. **显式区分源码回滚 vs 数据/迁移** —— Lovable 已踩坑并文档化。  
5. **Stop 后的局部 Undo** vs **历史 Revert** 分清 —— 避免一个「撤销」按钮两种语义。

### 9.3 建议不抄（Avoid）

1. **不抄「Google Docs」话术** —— Open-OX 品牌是工程流水线 / Harness，不是文档协作。  
2. **不把 GitHub commit 浏览器当主 UX** —— Lovable 虽「every edit is a commit」，用户主路径仍是 History panel + chat，不是 gh。  
3. **不在本 sprint 做 Revert/Undo** —— 产品文档已写明延后；可预留 API/UI 槽位。  
4. **不假设有「时光机」品牌或独立 History 营销页** —— Lovable 第一方也没有；功能嵌在编辑器工作流。  
5. **不把 Cloud DB 14 天备份 UX 当成项目版本时间线** —— 两套恢复面。  
6. **不发明 Lovable 未文档化的 UI**（常驻缩略图墙、胶片拖拽等）并声称「Lovable 就是这样」—— 仅 changelog 确认了 **hover screenshots**。

### 9.4 本 sprint 最小产品形状（对照）

| Open-OX 3.3（计划） | Lovable 公开对标 |
|---------------------|------------------|
| 每 Modify history turn 一条 | edit / version 条目 |
| 缩略图 | hover screenshot preview（常驻与否未文档化） |
| 一句话意图 | descriptive labels +（工程侧）更好的 commit message |
| 回放/点选看当时状态 | preview older version |
| 一键回滚 | **延后**；Lovable 为 Preview → Revert + 新 edit card |

---

## 10. 开放问题 / 第一方未写清

1. Version 与 chat message 的精确 1:1 规则（失败回合、Plan-only、空 diff、Visual/inline edit 是否各占一条）。  
2. Screenshot 生成管线与是否 **常驻** 缩略图。  
3. 项目 history **保留期限 / 套餐限额**。  
4. Bookmark 与 Pin 是否同一控件的不同文案。  
5. Revert 后「reapplied anytime」的具体 UI（一键 replay vs 手动再 prompt）。  
6. 登录态编辑器当前像素级布局（本调研未访问）。

---

## 11. 来源索引

| 主张 | 来源 |
|------|------|
| View history / 聊天上滚；preview；restore/revert 入口 | [FAQ](https://docs.lovable.dev/introduction/faq) |
| History 定义；bookmark checkpoints | [Glossary](https://docs.lovable.dev/glossary) |
| Version history 工作流；Google Docs 式 panel；Bookmark key edits | [Quick start](https://docs.lovable.dev/introduction/getting-started) |
| Every edit is a commit；Pin；Supabase revert 警告；Remix | [Best practices](https://docs.lovable.dev/tips-tricks/best-practice) |
| Stop → undo | [Build mode](https://docs.lovable.dev/features/agent-mode) |
| Bookmarks；按日分组；restore→新 edit card | [Versioning 2.0 博文](https://lovable.dev/blog/versioning-with-lovable-two-point-zero)（2025-03-03） |
| Descriptive labels；preview 可见性；最近 8 edits；懒加载 | [Better Version Management 博文](https://lovable.dev/blog/2025-01-13-better-version-management-and-speed-enhancements)（Published 2024-10-02） |
| Hover screenshots；Restore→Revert；History/Bookmarks tabs；commit messages；DB 不随 revert；active edit 高亮等 | [Changelog](https://docs.lovable.dev/changelog) |
| Cloud DB 备份 ~14 天；remix+backend 限制 revert | [Lovable Cloud](https://docs.lovable.dev/integrations/cloud) |
| Rollback 调试建议 | [Debugging prompts](https://docs.lovable.dev/prompting/prompting-debugging) |
| Audit log 保留 ~90 天 | [Audit logs](https://docs.lovable.dev/features/audit-logs) |
| 无独立 History feature 页 | [llms.txt](https://docs.lovable.dev/llms.txt) 目录检索，2026-07-10 |
| Open-OX 3.3 / Modify history turn | `docs/product/ux-expansion-ideas-20260710.md`；`CONTEXT.md` |

**方法说明**：检索与抓取限于 docs.lovable.dev、lovable.dev/blog、changelog；未采用 Medium/YouTube 二手综述。未登录产品 UI。
