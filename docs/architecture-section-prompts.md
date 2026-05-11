# Section 生成 Prompt 与 Guardrail 架构

本文是 **Open-OX 生成流水线里 section 相关提示词** 的说明：`generate_section` 的堆叠顺序、项目级规则如何加载。  
**完整流水线步骤、skill 预选细节与日志说明**：应用内 **`/docs/generate-project-trace`**；仓库入口与说明见 [generate-project-trace.md](./generate-project-trace.md)。

---

## 1. Page / Architect Agent 的 System：规则加载方式

Section 文案与红线统一放在 **`prompts/rules/*.md`**。`prompts/sections/` 目录已并入 `rules/`（例如 `section.default.md`、`section.navigation.md`）。

**动态拼装**：列表集中在 `ai/flows/generate_project/shared/agentRuleBundles.ts`：

- `PAGE_IMPLEMENT_AGENT_RULE_IDS_BASE` → `resolvePageImplementAgentRuleIds()`，由 `steps/pageImplementAgent.ts` 在 `composePromptBlocks` 里按序 `loadGuardrail(id)`。
- `ARCHITECT_AGENT_RULE_IDS_BASE` → `resolveArchitectAgentRuleIds()`，由 `steps/architectAgent.ts` 同样拼接。

可选扩展环境变量（逗号分隔追加 id，**不**改代码即可试规则）：

- `PAGE_IMPLEMENT_AGENT_EXTRA_RULES` — 逗号分隔的 rule id（与 `prompts/rules/<id>.md` 文件名一致，不含 `.md`）
- `ARCHITECT_AGENT_EXTRA_RULES`

**`page_implement_agent` 默认顺序**（在 `frontend` + `steps/pageImplementAgent.md` 之后）：

```
1. tailwindMappingGuide
2. section.default
3. skillIntegrationContract
4. project.consistency
5. project.accessibility
6. outputTsx
7. framerMotionVariants
```

另：用户消息里会注入当次的 **design-system** 正文；**Hero skill** 若有预选，以用户消息块形式追加（不是 rules 文件）。

**`architect_agent` 默认顺序**（在 `frontend` + `steps/architectAgent.md` 之后）：

```
1. section.navigation
2. outputTsx
3. framerMotionVariants
```

流水线**不会**扫描 `prompts/rules/` 自动注入文件；只有通过 `agentRuleBundles` 基线列表与环境变量追加的 id 才会被 `loadGuardrail` 加载。

---

## 2. 项目级 `project.*`（与 page agent 规则栈对齐）

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
