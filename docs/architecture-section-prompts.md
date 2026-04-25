# Section 生成 Prompt 与 Guardrail 架构

本文是 **Open-OX 生成流水线里 section 相关提示词** 的说明：`generate_section` 的堆叠顺序、项目级规则如何加载。  
**完整流水线步骤、skill 预选细节与日志说明**：应用内 **`/docs/generate-project-trace`**；仓库入口与说明见 [generate-project-trace.md](./generate-project-trace.md)。

---

## 1. `generate_section` 的 System 堆叠顺序（与实现一致）

由下而上（`steps/generateSection/index.ts` → `buildSystemPrompt` → `composePromptBlocks`）：

```
1. frontend              ← ai/prompts/systems/frontend.md
2. Design system 正文      ← 当次 run 的 design-system.md 注入
3. tailwindMappingGuide  ← prompts/rules/tailwindMappingGuide.md
4. section.default + section.{type} ← prompts/sections/
5. skillIntegrationContract ← prompts/rules/skillIntegrationContract.md
6. 组件 / 技术 skill（可选）← prompts/skills/{id}.md
7. project.consistency  ← prompts/rules/project.consistency.md（显式固定）
8. project.accessibility← prompts/rules/project.accessibility.md
9. outputTsx             ← prompts/rules/outputTsx.md
10. framerMotionVariants ← prompts/rules/framerMotionVariants.md
```

不再做运行时「扫描 / 按 section 类型推断」规则 id 列表；`prompts/rules/section.*.md` 若保留，仅作**文档或将来手工并入 section 提示词**之用，**不会**经 `infer*` 自动注入。

---

## 2. 项目级 `project.*`（与 `generate_section` 对齐）

| ID | 说明 |
|----|------|
| `project.consistency` | 跨 section 视觉与组件用语一致 |
| `project.accessibility` | 对比度、语义结构、可及性 |

在代码中：`loadGuardrail("project.consistency")` 与 `loadGuardrail("project.accessibility")` 显式加入 `composePromptBlocks`。

---

## 3. Capability assists（与 guardrail 区分）

- **上述规则**：`loadGuardrail` 固定 id，红线与一致性格式。  
- **Capability assist**：版式/动效等「小抄」，id 由 `plan_project` 中 **Allowed Capability Assist IDs** 约束；解析见应用内 **`/docs/generate-project-trace`** §5。

---

## 4. 相关文档

- [section-skill-rules.md](./section-skill-rules.md) — flow 内 `prompts/skills` 约定  
- **`/docs/generate-project-trace`**（应用内）/ [generate-project-trace.md](./generate-project-trace.md) — 全链路步骤、skill 预选、日志路径  
