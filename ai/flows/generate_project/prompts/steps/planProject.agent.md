## 步骤提示词：Plan Project — Agent 实现模式（无预切片）

下游将用 **多轮工具循环**（读/写/编辑文件）实现整页 UI。**本步骤定「页面级产品与体验纲要」+ chrome 形态**，不负责列出 `sections` 文件名或区块数量。

### 你需要产出什么

1. 合法 JSON。
2. 顶层 **`chromeForm`**（必填）与可选 **`sharedContracts`**。
3. 每个 page 必须有完整的 `pageDesignPlan`。
4. 每个 page 的 **`sections` 必须为 `[]`**（空数组）。

## Chrome-first 契约

全局壳由下游 **Chrome Scaffold** 先写，Page Agent 只填内容。本步骤**必须**选定 `chromeForm`：

| chromeForm | 何时 |
|---|---|
| `top-nav+footer` | marketing / landing / 官网 |
| `top-nav` | 只要顶栏、弱页脚 |
| `sidebar` | admin / dashboard |
| `bottom-tabs` | 移动 App 式底栏主导航 |
| `page-local` | 沉浸式信息流 / 短视频等壳与内容不可分 |
| `none` | 全屏游戏 / 舞台、无站点壳 |

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
      "description": "与分析阶段一致的一句话",
      "journeyStage": "entry",
      "pageDesignPlan": {
        "pageGoal": "...",
        "narrativeArc": "...",
        "layoutStrategy": "...",
        "hierarchy": ["...", "..."],
        "constraints": ["...", "..."]
      },
      "sections": []
    }
  ]
}
```

字段规则（严格）：

- 顶层包含：`chromeForm`、`sharedContracts`（可空数组）、`pages`。
- `pages.length === 1`，且 `slug === "home"`（多页站点除外，以 analyze 阶段 pageMap 为准）。
- 每个 `sections` **必须**存在且为 **空数组**。
- **pageDesignPlan** 键固定：`pageGoal`、`narrativeArc`、`layoutStrategy`、`hierarchy`、`constraints`。

## 输出

只输出 JSON。
