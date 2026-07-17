## 步骤提示词：Plan Project — Agent 实现模式（无预切片）

下游将用 **多轮工具循环**（读/写/编辑文件）实现整页 UI。**本步骤定「页面级产品与体验纲要」+ chrome 形态**，不负责列出 `sections` 文件名或区块数量。

### 你需要产出什么

1. 合法 JSON。
2. 顶层 **`chromeForm`**（必填）与可选 **`sharedContracts`**。
3. 每个 page 必须有完整的 `pageDesignPlan`。
4. 每个 page 的 **`sections` 必须为 `[]`**（空数组）。

## Chrome-first 契约

全局壳（Nav / Sidebar / Footer / bottom tabs）**一律**由下游 **Chrome Scaffold** 写入 `components/chrome/**` 并挂进 `app/layout.tsx`。Page Agent **只填内容区**，禁止写壳。本步骤**必须由你自行判断** `chromeForm`：

- 标签仅作壳形态编排：`top-nav+footer` | `top-nav` | `sidebar` | `bottom-tabs` | `none`
- **根据 brief 与页面纲要决定壳形态**（营销站常用 `top-nav+footer`；工具台常用 `sidebar`；移动 App 常用 `bottom-tabs`）
- `none` = Scaffold 仍拥有 layout，但采用极简/无营销导航的壳（**不是**把壳交给 Page）
- **禁止**使用已删除的 `page-local`（壳不能由页面实现）
- **禁止**套用死板产品类型配方；但仍须选出一种由 Chrome 落盘的壳形态

有 list + detail（或其它共享实体卡片）时，填写 `sharedContracts`（实体名、字段、建议 `components/shared/*.tsx` 路径、listSlug、detailRoutePattern）。无则 `[]`。

### `pageDesignPlan` 写法（关键）

- **pageGoal**：本路由在 MVP 下单句目标。
- **narrativeArc**：用户在该页上的信息与任务流动。
- **layoutStrategy**：页面**内容区**布局族（多栏、单栏滚动、舞台+HUD 等），**不要**再描述全局 Nav（已由 chromeForm 决定）。
- **hierarchy**：从主到次的信息/功能区。
- **constraints**：硬约束与禁区。

### 输出示例（结构示意）

```json
{
  "chromeForm": "top-nav+footer",
  "sharedContracts": [],
  "pages": [
    {
      "title": "Home",
      "slug": "home",
      "description": "...",
      "journeyStage": "discover",
      "primaryRoleIds": [],
      "supportingCapabilityIds": [],
      "sections": [],
      "pageDesignPlan": {
        "pageGoal": "...",
        "narrativeArc": "...",
        "layoutStrategy": "...",
        "hierarchy": ["..."],
        "constraints": ["..."]
      }
    }
  ]
}
```

### 硬性要求

- 顶层包含：`chromeForm`、`sharedContracts`（可空数组）、`pages`。
- 每个 page 的 `sections` 必须是 `[]`。
- `chromeForm` 必须是你基于 brief 的判断，不是默认营销站模板。
