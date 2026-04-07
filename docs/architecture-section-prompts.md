# Section 生成 Prompt 与 Guardrail 架构

本文是 **Open-OX 生成流水线里 section 相关提示词的入口说明**：分层顺序、guardrail 白名单、规划合并行为。  
**完整流水线步骤、skill 预选细节与日志说明**：应用内 **`/docs/generate-project-trace`**；仓库入口与说明见 [generate-project-trace.md](./generate-project-trace.md)。

---

## 1. `generate_section` 的 System 堆叠顺序（与实现一致）

由下至上依次拼接（`steps/generateSection.ts` → `buildSystemPrompt`）：

```
1. frontend（全局栈与输出习惯）     ← ai/prompts/systems/frontend.md
2. section.default + section.{type} ← prompts/sections/
3. 组件 skill（可选）               ← prompts/skills/{id}.md
4. Guardrails                       ← projectGuardrailIds ∪ designPlan.guardrailIds → loadGuardrail
5. Traits（可选）                  ← designPlan.traits → buildTraitsBlock（内联生成）
6. outputTsx                        ← 输出形态契约（仍在 system 末段）
```

说明：**`outputTsx` 在 traits 之后**，不要与「第 4 层 guardrail 正文」画在同一层里。

---

## 2. Guardrail 白名单（单一真相）

**发现逻辑**在 `ai/flows/generate_project/planners/guardrailPolicy.ts`：**允许 ID**来自 `prompts/rules/` 下的 `section.*.md` / `project.*.md` 文件名（运行时 `readdir` + 可选 YAML frontmatter），不再维护手写常量表。

### 2.1 项目级 `projectGuardrailIds`

| ID | 说明 |
|----|------|
| `project.consistency` | 跨 section 视觉与组件用语一致 |
| `project.accessibility` | 对比度、语义结构、可及性 |

### 2.2 Section 级 `designPlan.guardrailIds`（规划器允许的全部 ID）

| ID | 说明 |
|----|------|
| `section.core` | 自包含、无 props、生产级、响应式等 |
| `section.accessibility` | 语义地标、标题层级、ARIA |
| `section.layout` | 外层/内层结构、区块分隔 |
| `section.typography` | 字体角色与层级 |
| `section.styles` | 不在组件内造全局样式，复用 globals |
| `section.above-fold` | 首屏相关（hero、navigation） |
| `section.interactive` | 交互控件（pricing、faq、navigation） |

**默认推断**（与 `plan_project` 合并前一致）：`inferSectionGuardrailDefaults(section)` — 全体带 core / accessibility / layout / typography / styles；hero 与 navigation 额外 `section.above-fold`；pricing、faq、navigation 额外 `section.interactive`。

### 2.3 规划合并（避免「模型写少了就丢 guardrail」）

- **`plan_project` 的 user 消息**里列出的 Allowed Section / Project Guardrail IDs 与磁盘上规则文件一致（`getAllowedSectionGuardrailIds()` / `getAllowedProjectGuardrailIds()`）。
- 合并时：
  - **Section**：`guardrailIds = mergeSectionGuardrailIds(模型输出, inferSectionGuardrailDefaults(section))` — 在**允许集合内**取模型补充项，并与默认**并集去重**，不会删掉默认里的 `layout` / `typography` / `styles`。
  - **Project**：`projectGuardrailIds = mergeProjectGuardrailIds(模型输出, defaultPlan.projectGuardrailIds)`。

Guardrail 正文统一从 `prompts/rules/{id}.md` 加载（`loadGuardrail` → `getRulePath`）。

---

## 3. Traits（与 guardrail 区分）

- **Guardrail**：红线与一致性，id 必须在上一节白名单内。  
- **Traits**：结构化的 layout/motion/visual/interaction 描述，由 `plan_project` 自由生成（无白名单约束）；解析见应用内 **`/docs/generate-project-trace`** §5。

---

## 4. 扩展指南

- **允许 ID 与默认挂载**由 `prompts/rules/` 扫描得到，无需在 `guardrailPolicy.ts` 里手写列表。  
- 新增 **section 级 guardrail**：增加 `section.xxx.md` 即自动进入 planner 白名单；可选 YAML frontmatter：  
  - `guardrailDefaultFor: all`（默认，可省略）— 所有 section 类型都会带上该 guardrail。  
  - `guardrailDefaultFor: [hero, navigation]` — 仅列出的 `section.type` 默认带上。  
  - `guardrailPlannerOnly: true` — 不参与默认合并，仅当 planner 在 JSON 里显式写出时才生效。  
- 新增 **项目级**：增加 `project.xxx.md` 即自动进入项目级白名单；非 `guardrailPlannerOnly` 的规则会进入 `inferProjectGuardrailDefaults()`（`buildDefaultProjectPlan` 使用）。  
- `outputJson` / `outputTsx` 等非 `section.*` / `project.*` 规则不参与上述白名单，仍可通过 `loadGuardrail` 在步骤里引用。

---

## 5. 相关文档

- [section-skill-rules.md](./section-skill-rules.md) — flow 内 `prompts/skills` 约定  
- **`/docs/generate-project-trace`**（应用内）/ [generate-project-trace.md](./generate-project-trace.md) — 全链路步骤、skill 预选、日志路径  
