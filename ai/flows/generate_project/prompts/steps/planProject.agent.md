## 步骤提示词：Plan Project — Agent 实现模式（无预切片）

下游将用 **多轮工具循环**（读/写/编辑文件）实现整页 UI，就像真实工程里在 IDE 里边写边抽组件。**本步骤只定「页面级产品与体验纲要」**，不负责列出 `sections` 文件名或区块数量。

### 你需要产出什么

1. 合法 JSON。
2. 每个 page 必须有完整的 `pageDesignPlan`（与旧版同结构）。
3. 每个 page 的 **`sections` 必须为 `[]`**（空数组）。不要输出任何 `type` / `fileName` / `intent` / `contentHints` 的 section 项。

## 全局壳层（若有）
若分析阶段 blueprint 含 \`layoutSections\` / navigation+footer，则顶栏与页脚会在 \`app/layout.tsx\`；主路由实现 Agent **勿**再复制一套全局主导航/页脚。若 \`layoutSections\` 为空，则根布局极简，由你在本页及其 \`components/\` 中组织完整界面（含所需壳层）。

### `pageDesignPlan` 写法（关键）

要写 **实现者可执行的页面纲要**，而不是营销文案模板：

- **`pageGoal`**：本路由在 MVP 下单句目标。
- **`narrativeArc`**：用户在该页上的信息与任务流动（可为非线性；可为工具型主循环）。
- **`layoutStrategy`**：允许的布局族（如：多栏壳、单栏滚动、舞台+HUD、表格式等），**禁止**写死「必须 N 个 Section」或具体文件名。
- **`hierarchy`**：从主到次的信息/功能区（抽象层级，不是组件名）。
- **`constraints`**：硬约束与禁区（可访问性、不要做双导航、动效上限、与全局 layout 的关系等）。

### `site` 覆盖

若 JSON 顶层需要带 `site`，仅当你要**覆盖**分析阶段的 `layoutSections` 时才输出 `site.layoutSections`；否则可省略 `site`，合并逻辑会保留 analyze 结果。

### 输出示例（结构示意）

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

字段规则（严格）：

- 顶层必须且只包含：`pages`（除非你同时合法地附加 `site` 对象）。
- `pages.length === 1`，且 `slug === "home"`。
- 每个 `sections` **必须**存在且为 **空数组**。
- **`pageDesignPlan`** 键固定：`pageGoal`、`narrativeArc`、`layoutStrategy`、`hierarchy`（非空字符串数组）、`constraints`（非空字符串数组）。

## 输出

只输出 JSON。
