# Workspace · Community · Publish · Remix · v0.1

**版本**：v0.1  
**日期**：2026-07-09  
**状态**：已定稿（grilling 确认；待实现）  
**ADR**：[docs/adr/0002-workspace-private-community-publish-remix.md](../adr/0002-workspace-private-community-publish-remix.md)  
**调研**：[docs/research/lovable-community-publish-remix-20260709.md](../research/lovable-community-publish-remix-20260709.md)

---

## Problem

今天 Open-OX 的项目列表对**已登录用户全局可读**（`/projects` 默认「全部成员」，`?mine=1` 才是自己的），没有显式的发布 / remix / 可见性字段。静态预览 URL 对 guest 基本「有链就能看」。

目标场景：

1. 用户在 **Workspace** 只看到自己的项目（默认私有）。
2. 作者可把作品 **发布到 Community**，他人可 **静态预览**。
3. 作者可另开 **Allow Remix**，他人登录后拷贝到自己的 Workspace。
4. Remix **日后可收费**；本期只留语义与扩展点，不实现计费。

---

## Product model

### Surfaces

| Surface | Route（约定） | 谁可见 | 内容 |
|---------|---------------|--------|------|
| **Workspace** | `/projects` | 仅所有者（须登录） | 自己的项目；保留文件夹 |
| **Community** | `/community` | 任何人（含未登录） | 已开启 Publish Preview 的项目 |
| **Admin all-projects** | 内部入口（非社区产品面） | Admin | 全部项目；排障 / 强制下架 |

旧「全部成员」全局 gallery **下线**，不作为第三 Tab。

### Two axes

| Axis | 含义 | 社区列表 | 非所有者能力 |
|------|------|----------|--------------|
| **Publish Preview** | 作品上架社区 + 静态预览可被非所有者打开 | **进列表的条件** | 看静态预览；**不能**进 Studio |
| **Allow Remix** | 授予拷贝许可 | 卡片上的能力开关 | 登录后 Remix → 自己的新项目 |

依赖（产品规则，非「合成一轴」）：

- 仅当 Publish Preview = on 时可开 Allow Remix。
- 关闭 Publish Preview → **自动关闭** Allow Remix。
- Allow Remix 默认 **off**。

### Preview

- Community / 分享预览 = **静态预览 only**（现有 `site-previews` / 构建产物）。
- **本期不做** live preview、只读 Studio、协作者邀请。
- 开启 Publish Preview 的前提：项目**已有可用静态预览**；否则开关禁用并引导先生成预览。
- Publish Preview 开启期间：后续构建成功后的静态预览 **自动**成为社区所见；Remix 始终拷 **当前最新**源码。
- Publish Preview = off 时：非所有者（含匿名）访问预览 URL / cover → **403/404**（硬切断）。

### Remix

| 项 | 规则 |
|----|------|
| 拷贝内容 | 站点源码快照 + 展示元数据（名称、封面等）+ 血缘 |
| 不拷贝 | Studio 对话、agent 轨迹 |
| 排除 | `.env*`、密钥类文件等 exclude 清单（非整目录盲拷） |
| 所有权 | Remixer 成为新项目 owner；与源项目断开 |
| 血缘 | `remixed_from_project_id` + 原作者名 / 原标题等快照；源删除后显示「来源已删除」类文案 |
| 成功后 UX | 进入新项目 Studio；默认名 `原名 (Remix)`；文件夹 = 未分类；短暂提示血缘 |
| 再发布 | 副本可再开 Publish Preview / Allow Remix（可形成链；UI 本期只展示一层血缘） |
| 授权语义 | 开启 Allow Remix = **拷贝许可**：他人可创建独立副本并修改/再发布；原作者**不**控制副本。日后收费 = 获得该许可的门槛，**不是**租用 |

关闭 Publish Preview 或删除源项目：

- 社区即时下架；预览对非所有者即时失效。
- **已 Remix 出的副本保留**，原作者收不回。

### Unlisted（预留）

- 本期：**开 Publish Preview = listed**（进 `/community`）；无单独 unlisted UI。
- Schema **预留** unlisted（或等价字段），实现可后开「有预览直链、不进发现列表」。

### Migration

- 全部现有项目 → **私有**（Publish Preview off，Allow Remix off）。
- 上社区需作者重新开启 Publish Preview（须已有静态预览）。
- 不做「已有 preview 自动上架」。

### Admin

- 内部全量项目视图（可预览 / 进 Studio 排障）。
- 可 **强制关闭** Publish Preview（连带关 Allow Remix）；项目仍在作者 Workspace。
- 本期不做 soft-lock「禁止作者再发布」。

### Author controls UI

- **主入口**：Studio（设置 / 顶栏「发布」面板）。
- **快捷**：`/projects` 卡片菜单也可开关。
- 两处改同一对字段。

---

## MVP scope

**In**

- 权限翻盘（owner-only 默认 + Community 读模型）
- `/projects` 仅自己的；`/community` 已发布列表（简单：封面 + 最新等，无复杂发现）
- Publish Preview / Allow Remix 双开关 + 依赖规则 + 静态预览门禁
- 未发布预览 URL 硬切断
- Remix API + 排除清单 + 血缘 + 成功进 Studio
- Admin 全量视图 + 强制下架
- 迁移：全部收回私有

**Out（明确后置）**

- Remix 收费 / 分成
- Unlisted UI
- Live preview、只读 Studio、邀请协作者
- 社区搜索 / 多维排序 / remix 次数排行 / 完整 remix 图谱
- 发布版本钉扎（社区钉某次快照）

---

## Implementation sketch（非绑定实现细节）

实现阶段可按此切开，细节以代码与 migration 为准。

### Data

在 `projects`（或等价表）上增加大致字段：

| 字段 | 用途 |
|------|------|
| `publish_preview`（bool） | 是否上架社区 + 非所有者可静态预览 |
| `allow_remix`（bool） | 是否允许 Remix；仅当 `publish_preview` 时有效 |
| `visibility` / `listing`（预留） | 未来 `listed` \| `unlisted`；本期可恒为 listed-when-published |
| `remixed_from_project_id`（nullable FK） | 血缘 |
| `remixed_from_title` / `remixed_from_owner_username`（snapshot） | 源删除后仍可展示 |

约束：应用层（或 DB check）保证 `allow_remix` ⇒ `publish_preview`。

### Access

| 操作 | 规则 |
|------|------|
| List Workspace | `user_id = auth.uid()` |
| List Community | `publish_preview = true`（anon + auth） |
| GET project metadata（非所有者） | 仅当 `publish_preview`（或 admin） |
| Static preview / cover（非所有者） | 仅当 `publish_preview` |
| Studio / mutate | 仅所有者（或 admin 排障）；社区项目对非所有者拒绝 |
| Remix | 登录 + 源 `publish_preview` + `allow_remix`；创建新行 + 拷盘（exclude） |

替换 migration `011` 的「authenticated SELECT all projects」心智；Community 与 Workspace 分政策。

### APIs（示意）

- `PATCH` 项目发布字段（owner；开 preview 时校验静态预览就绪）
- `GET /api/community/projects`（公开列表）
- `POST /api/projects/[id]/remix`（登录；成功返回新 `projectId`）
- Admin unlist = 同一发布字段写入（service role / admin gate）

### UI

- `/projects`：去掉「全部成员」；默认即「我的」；状态徽章（已发布 / 可 Remix）
- `/community`：卡片 → 静态预览；若 `allow_remix` 显示 Remix CTA（未登录 → 登录）
- Studio：发布面板（两开关 + 依赖禁用态 + 无预览时的引导）

---

## Glossary pointer

术语见根目录 [`CONTEXT.md`](../../CONTEXT.md)（Workspace / Community / Publish Preview / Allow Remix / Remix / Remix lineage）。

---

## Open follow-ups（不阻塞 v0.1）

1. Remix 定价、是否给原作者分成、免费额度。
2. Unlisted 预览直链与 token 过期（对齐 Lovable preview link 思路时再开）。
3. 协作者 / Shared with me（Lovable 有；本期刻意不做，避免与 Community 混权）。
4. 社区策展（官方模板区 vs 用户 Community）是否拆面。
