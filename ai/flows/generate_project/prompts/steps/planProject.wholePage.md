## 步骤提示：规划项目 — 整页（Line B — 单表面产品）

你将 `ProjectBlueprint` 转为 **Line B**（`layoutMode: whole-page`）的 `PlannedProjectBlueprint`：`/` 上的 **一个** 区块就是本流水线面向用户的 **完整** 产品，领域不限（feed、后台、游戏、工具等）。**不是** Line A（堆叠式营销/落地页）。

**不要**从内部一小份「允许的应用」列表里选产品。从 `projectTitle`、`projectDescription`、`mvpDefinition` 与页面文案中的 **领域词汇** 推导 `type` 和 `fileName`。

### 要产出什么

1. 保持为合法 JSON 结构。
2. 为每个页面附加 `pageDesignPlan`。
3. 只输出 **恰好 1 个** 区块 —— 由它承载完整应用 UI。

### 单页规则（关键）

- 本流水线只构建一个页面（`slug: "home"`）。
- 不要杜撰额外页面/路由。
- 唯一内容区块放在 `pages[0].sections`，且仅一条。

### 这唯一一个区块

在 `pages[0].sections` 中输出恰好 **1** 个区块。该区块即完整应用界面。

**命名 `type` 与 `fileName`（无固定目录）**

- `**type`**：来自 **用户产品** 的 `PascalCase` 标识（如简介中的用词），说明「它 **是** 什么」—— 不要用 `MainContent`、`App` 等泛化名，除非用户确实没有给任何领域词。
- `**fileName`**：格式为 `"{相同词干}Section"`，且与导出组件词干一致（如 `RacingGridSection` → 组件名 `RacingGridSection`）。

`**intent`**：用 1–2 句话写该表面的 **主循环或主任务**：用户 **反复** 或 **首先** 做什么，以及怎样算「完成」。不要用营销定位话术。

`**contentHints`**：要具体、且 **不绑定某种形态** —— 描述真实 UI，不要套模板：

- **布局形态**：例如多窗格应用壳、**或** 全幅 **舞台**（游戏/画布/工具）+ 控件/HUD、**或** 表格优先、**或** 单列滚动 feed —— **以产品为准**。
- **主要区域与承载内容**（只写 applicable 的）：chrome（导航/栏）、**主交互面**、侧栏、抽屉、底栏、工具轨等。
- **交互与密度**：关键 affordance、合理 mock **数量**（行、列表项、实体），避免下游生成过空；若相关则写明输入方式（键盘、拖拽等）。

---

### 规划风格

- 像产品 / 工具 / 玩法设计 —— 不是 **落地页** 文案。**不要** 默认 Hero → 功能点 → 证言，**除非** 用户明确要的是推广面（`whole-page` 里通常不是）。
- 目标是对所述领域有 **可信、可交互** 的界面，而不是 Behance 风营销假图。

### 输出约束

- 只返回 JSON（不要 markdown）。
- `pages[0].sections.length` 必须恰好为 `1`。

### `pageDesignPlan` 形状（与类型 `PageDesignPlan` 一致）

每个页面必须包含 `pageDesignPlan`，键固定为：

- `pageGoal`（string）
- `narrativeArc`（string）
- `layoutStrategy`（string）
- `hierarchy`（string[]，至少 2 条）
- `constraints`（string[]，至少 2 条）

整页产品场景下：叙事与层级应描述**可交互产品面**（首屏即主任务、持久 chrome、密度与真实 mock 数据），不要使用营销落地页话术。

### 固定输出结构（示例）

```json
{
  "pages": [
    {
      "title": "Home",
      "slug": "home",
      "description": "与输入 blueprint 页面描述一致",
      "journeyStage": "entry",
      "pageDesignPlan": {
        "pageGoal": "单句说明该产品面要完成的主任务",
        "narrativeArc": "首屏暴露主循环；次要能力在侧栏/抽屉/次要区域可达",
        "layoutStrategy": "以产品功能划分区域，而非营销叙事分段",
        "hierarchy": [
          "主交互面占据视觉与操作中心",
          "导航与结构区域持久且可预测",
          "密度与控件数量符合该领域（feed 可密、工具可疏）"
        ],
        "constraints": [
          "禁止营销式 Hero 宣言带、证言墙、FAQ 堆砌",
          "mock 数据在数量与字段上足够可信",
          "保持唯一 section 内完整壳层与主面，不拆成多条滚动营销块"
        ]
      },
      "sections": [
        {
          "type": "ExampleSurface",
          "intent": "主循环与成功态（1–2 句，具体）",
          "contentHints": "布局形态 + 主要区域 + 合理 mock 数量 + 关键交互",
          "fileName": "ExampleSurfaceSection"
        }
      ]
    }
  ]
}
```

