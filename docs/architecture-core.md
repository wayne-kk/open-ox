# AI 建站核心流水线说明

## 目标

这份文档描述当前真实运行的 AI 建站主链。

目标产物包括：

- `design-system.md`
- `app/globals.css`
- `components/sections/*.tsx`
- `app/page.tsx` 或 `app/<slug>/page.tsx`
- `app/layout.tsx`

但这些代码产物只是最后一层。  
真正的主链是：

`用户输入 -> MVP 边界 -> 角色 -> 任务闭环 -> 功能集合 -> 信息架构/页面地图 -> 页面设计 -> section 设计 -> 写代码`

## 端到端流程

### 1. `analyze_project_requirement`

文件：

- `ai/flows/generate_project/steps/analyzeProjectRequirement.ts`
- `ai/flows/generate_project/prompts/steps/analyzeProjectRequirement.md`

职责：

- 把自然语言需求转换成 `ProjectBlueprint`
- 先定义 `ProductScope`
- 再定义 `UserRole`
- 再定义 `TaskLoop`
- 再抽出 `CapabilitySpec`
- 再落到 `InformationArchitecture`
- 最后才给出 `pages`、`layoutSections`、`sections`

这一层的核心不是“想页面长什么样”，而是“想最小产品逻辑如何闭环”。

### 2. `plan_project`

文件：

- `ai/flows/generate_project/steps/planProject.ts`
- `ai/flows/generate_project/planners/defaultProjectPlanner.ts`
- `ai/flows/generate_project/prompts/steps/planProject.md`

职责：

- 把 `ProjectBlueprint` 细化成 `PlannedProjectBlueprint`
- 为每个页面生成 `PageDesignPlan`
- 为每个 section 生成 `SectionDesignPlan`
- 把设计决策绑定回角色 / 闭环 / capability
- 仅在必要时附加 `traits`（结构化的 layout/motion/visual/interaction 描述）

这一层的核心不是模板选型，而是：

- 这个页面服务谁
- 这个页面承接哪个闭环阶段
- 这个 section 在闭环里承担什么任务

### 3. `generate_project_design_system`

文件：

- `ai/flows/generate_project/steps/generateProjectDesignSystem.ts`

职责：

- 读取产品范围、角色模型、能力集合、页面地图、页面设计计划
- 生成统一设计系统

设计系统不再只服务视觉表达，也要服务产品类型和信任级别。

### 4. `apply_project_design_tokens`

文件：

- `ai/flows/generate_project/steps/applyProjectDesignTokens.ts`

职责：

- 把设计系统转换成 `app/globals.css`
- 落成 Tailwind v4 可消费的 token 与 utility

### 5. `generate_section`

文件：

- `ai/flows/generate_project/steps/generateSection.ts`

职责：

- 消费 `SectionDesignPlan`
- 消费 page context
- 消费产品逻辑上下文：
  - `ProductScope`
  - `UserRole`
  - `TaskLoop`
  - `CapabilitySpec`
- 按需附加 traits（结构化特征描述）

运行时更接近：

```text
frontend system
+ project guardrails
+ optional traits block
+ product scope
+ role / task loop / capability context
+ page context
+ section design brief
+ outputTsx
```

### 6. `compose_page`

文件：

- `ai/flows/generate_project/steps/composePage.ts`

职责：

- 根据 `PageDesignPlan` 组合页面
- 保留页面在用户旅程中的位置
- 保留页面服务的角色和能力上下文

### 7. `compose_layout`

文件：

- `ai/flows/generate_project/steps/composeLayout.ts`

职责：

- 根据共享壳层 section 的 `shellPlacement` 注入 `app/layout.tsx`
- 不再只硬编码 `navigation/footer` 单例假设

### 8. `run_build`

职责：

- 运行构建
- 作为生成完成后的工程闸门

### 9. `repair_build`

职责：

- 仅在构建失败时触发
- 在有限文件范围内修复
- 再次进入 build 验证

## 核心类型

### Product Logic Layer

```ts
interface ProductScope
interface UserRole
interface TaskLoop
interface CapabilitySpec
interface InformationArchitecture
interface PageMapEntry
```

### Design Layer

```ts
interface PageDesignPlan
interface SectionDesignPlan
```

### Output Layer

```ts
interface PlannedProjectBlueprint
interface PlannedPageBlueprint
interface PlannedSectionSpec
```

## Prompt 资产的定位

### 仍然保留的

- `prompts/steps/*`
- guardrails
- traits（结构化特征描述，替代旧的 capability assists 白名单）

### 已经降级的

- `prompts/sections/*`
- `prompts/layouts/*`
- `prompts/motions/*`
- `prompts/capabilities/*`
- `selectors/sectionPromptSelector.ts`

这些 legacy 资产不再主导运行时设计决策。

## 关键判断标准

如果一个问题属于下面这些范畴，它应该进入产品逻辑层，而不是 prompt：

- 是否需要这个页面
- 页面服务哪个角色
- 页面承接哪个任务闭环
- section 为什么存在
- capability 为什么需要被表达

如果一个问题属于下面这些范畴，它才适合用 traits 表达：

- 复杂 Hero 表达
- 复杂 Dashboard pattern
- 高难动效
- 复杂交互 orchestration

## 当前边界

系统现在更自由了，但仍然保留工程边界：

- 结构化输出优先
- Flow 稳定优先
- build / repair 受控优先

这是为了让系统成为“产品逻辑驱动的 AI 建站器”，而不是“无限游走的提示词实验场”。
