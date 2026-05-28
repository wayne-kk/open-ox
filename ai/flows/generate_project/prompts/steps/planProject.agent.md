## 步骤提示词：Plan Project — Agent 实现模式（无预切片）

下游将用 **多轮工具循环**（读/写/编辑文件）实现整页 UI，就像真实工程里在 IDE 里边写边抽组件。**本步骤只定「页面级产品与体验纲要」**，不负责列出 `sections` 文件名或区块数量。

### 你需要产出什么

1. 合法 JSON。
2. 每个 page 必须有完整的 `pageDesignPlan`（与旧版同结构）。
3. 每个 page 的 `**sections` 必须为 `[]`**（空数组）。不要输出任何 `type` / `fileName` / `intent` / `contentHints` 的 section 项。

## 与实现 Agent 的关系

下游实现 Agent 工作在整个 `app/` 目录中：自己决定 `app/layout.tsx` 形态（顶 nav+footer / sidebar / 工具栏 / 无 chrome 等）、自己决定 `page.tsx` 内容、自己抽取 `components/`。本步骤**不要**预先指定 chrome 形态——把 layout 决策完全交给实现 Agent。

### `pageDesignPlan` 写法（关键）

要写 **实现者可执行的页面纲要**，而不是营销文案模板：

- `**pageGoal`**：本路由在 MVP 下单句目标。
- `**narrativeArc**`：用户在该页上的信息与任务流动（可为非线性；可为工具型主循环）。
- `**layoutStrategy**`：允许的布局族（如：多栏壳、单栏滚动、舞台+HUD、表格式等），**禁止**写死「必须 N 个 Section」或具体文件名。
- `**hierarchy`**：从主到次的信息/功能区（抽象层级，不是组件名）。
- `**constraints**`：硬约束与禁区（可访问性、动效上限、信息密度等）。**不要**在这里讨论「是否有全局 nav/footer」——那是实现 Agent 的事。

### 输出示例（结构示意）

**仅当上游 `site.pages.length === 1` 时使用单条：**

```json
{
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

**上游若给出多条路由，则示例（条数必须与上游一致）：**

```json
{
  "pages": [
    {
      "title": "Landing",
      "slug": "home",
      "description": "与分析阶段 slug=home 一致",
      "journeyStage": "entry",
      "pageDesignPlan": { "pageGoal": "", "narrativeArc": "", "layoutStrategy": "", "hierarchy": ["..."], "constraints": ["..."] },
      "sections": []
    },
    {
      "title": "Science",
      "slug": "science",
      "description": "与分析阶段一致",
      "journeyStage": "consider",
      "pageDesignPlan": { "pageGoal": "", "narrativeArc": "", "layoutStrategy": "", "hierarchy": ["..."], "constraints": ["..."] },
      "sections": []
    }
  ]
}
```

字段规则（严格）：


- 顶层必须且只包含：`pages`（除非你同时合法地附加 `site` 对象）。
- `pages` 数组必须与上一步（需求分析）给出的 `site.pages` **一一对应**：**相同条数、相同 `slug` 顺序与取值**；**禁止**合并、丢弃或偷偷新增路由。
- 仅当上游为**单页**站点时：`pages.length === 1` 且 `slug === "home"`。
- 每个 `sections` **必须**存在且为 **空数组**。
- `**pageDesignPlan`** 键固定：`pageGoal`、`narrativeArc`、`layoutStrategy`、`hierarchy`（非空字符串数组）、`constraints`（非空字符串数组）。

## 输出

只输出 JSON。