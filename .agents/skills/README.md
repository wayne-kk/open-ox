# Agent Skills 使用指南

本目录共 **22** 个 skill。在 Cursor Agent 对话中启用：

```text
@.agents/skills/<name>/SKILL.md
```

或在 prompt 里写：`请使用 <skill-name> skill`。

---

## 怎么选

| 你说的话 | Skill |
| --- | --- |
| 「先出设计图再写代码」 | image-to-code |
| 「别那么 AI 味，做 landing」 | design-taste-frontend |
| 「把这个旧站改好看」 | redesign-existing-projects |
| 「写 PRD / 拆 issue」 | to-prd / to-issues |
| 「实现 #123」 | implement |
| 「测试先行」 | tdd |
| 「review 这个分支」 | code-review |
| 「查为什么挂了」 | diagnosing-bugs |
| 「调研 XX」 | research |
| 「grill 方案」 | grilling / grill-me / grill-with-docs |
| 「交接给下一个 agent」 | handoff |
| 「教我这模块」 | teach |
| 「设计模块边界」 | codebase-design |
| 「扫架构债」 | improve-codebase-architecture |
| 「先做个可抛弃原型」 | prototype |
| 「统一术语 / 写 ADR」 | domain-modeling |
| 「分流 issue」 | triage |
| 「写 / 改 skill」 | writing-great-skills |
| 「首次配工程 skill」 | setup-matt-pocock-skills |

---

## 完整目录

### 基础设施

| Skill | 何时用 |
| --- | --- |
| [setup-matt-pocock-skills](setup-matt-pocock-skills/SKILL.md) | **首次**使用其他工程 skill 前：配置 Issue Tracker、Triage 标签、Domain 文档布局 |
| [writing-great-skills](writing-great-skills/SKILL.md) | 自建或改写 skill |

```text
@setup-matt-pocock-skills 配好 Issue Tracker + triage 标签 + docs/adr。
```

### 规划 · 研究 · 文档

| Skill | 何时用 |
| --- | --- |
| [research](research/SKILL.md) | 查权威资料，产出 Markdown 调研文件 |
| [to-prd](to-prd/SKILL.md) | 把当前对话合成 PRD 并发布到 Issue Tracker |
| [to-issues](to-issues/SKILL.md) | 把 PRD/计划拆成可独立领取的 Issue（纵向切片） |
| [domain-modeling](domain-modeling/SKILL.md) | 统一语言、术语表、ADR |
| [handoff](handoff/SKILL.md) | 压缩对话为交接文档，换 Agent / 换会话继续 |

```text
@to-prd 根据刚才讨论写 PRD 并创建 issue。
@to-issues 把这份 PRD 拆成 tracer-bullet issues。
@research 调研 XX，写到 docs/research/。
```

### 设计 · 架构 · 原型

| Skill | 何时用 |
| --- | --- |
| [codebase-design](codebase-design/SKILL.md) | 设计模块边界、加深抽象、定 seam |
| [improve-codebase-architecture](improve-codebase-architecture/SKILL.md) | 扫描加深机会，出 HTML 报告后逐项 grill |
| [prototype](prototype/SKILL.md) | 可抛弃原型验证状态机 / UI 方向 |
| [grill-me](grill-me/SKILL.md) | 面试式拷问计划 |
| [grilling](grilling/SKILL.md) | 同上（触发词 grill） |
| [grill-with-docs](grill-with-docs/SKILL.md) | Grill 同时产出 ADR / glossary |

```text
@improve-codebase-architecture 扫描某模块，出 HTML 报告。
@prototype 用 throwaway 页面验证状态机是否合理。
@grilling 拷问这份重构方案。
```

### 视觉 · 前端

| Skill | 何时用 |
| --- | --- |
| [image-to-code](image-to-code/SKILL.md) | 先出 section 设计图 → 深度分析 → 写代码；视觉质量是核心时 |
| [design-taste-frontend](design-taste-frontend/SKILL.md) | brief 已清楚，直接 anti-slop 前端，不需要 Agent 生图 |
| [redesign-existing-projects](redesign-existing-projects/SKILL.md) | 审计现有站并增量升级，不推翻功能 |

| 场景 | 用哪个 |
| --- | --- |
| 从零做 premium 页，需要出图 | **image-to-code** |
| 从零做页，brief 已很清楚 | **design-taste-frontend** |
| 已有站要改视觉 | **redesign-existing-projects** |
| 出图定稿后微调 | image-to-code → **design-taste-frontend** |

详细用法：[image-to-code/USAGE.md](image-to-code/USAGE.md)

```text
@image-to-code 多 section landing，每 section 独立大图后再实现。
@design-taste-frontend 按 brief 做 portfolio。
@redesign-existing-projects 审计首页，去掉 AI slop。
```

### 实现 · 测试 · Review · 排错

| Skill | 何时用 |
| --- | --- |
| [implement](implement/SKILL.md) | 按 PRD/Issue 实现（内建 tdd + code-review） |
| [tdd](tdd/SKILL.md) | Red-Green-Refactor，偏 integration |
| [code-review](code-review/SKILL.md) | Standards + Spec 双轴 Review |
| [diagnosing-bugs](diagnosing-bugs/SKILL.md) | 难 bug / 性能回归 |
| [triage](triage/SKILL.md) | Issue/PR 状态机分流，写 agent-ready brief |

```text
@implement 实现 issue #42。
@tdd 先写测试再实现。
@code-review 对比 main...HEAD，Standards + Spec。
@diagnosing-bugs 线上挂、本地正常。
@triage 分到 ready-for-agent 并写 brief。
```

### 学习

| Skill | 何时用 |
| --- | --- |
| [teach](teach/SKILL.md) | 在本仓库语境里系统学某个概念 / 模块 |

---

## 子文档

| 文档 | 内容 |
| --- | --- |
| [image-to-code/USAGE.md](image-to-code/USAGE.md) | image-to-code 出图规则、prompt 模板、验收清单 |
| [triage/AGENT-BRIEF.md](triage/AGENT-BRIEF.md) | Agent-ready Issue Brief 写法 |
| [domain-modeling/CONTEXT-FORMAT.md](domain-modeling/CONTEXT-FORMAT.md) | 领域 CONTEXT 格式 |
| [codebase-design/DEEPENING.md](codebase-design/DEEPENING.md) | Deep module 加深指南 |
