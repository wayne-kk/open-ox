# Section Skill 规则文档

本文档定义 Section 相关技能的编写规范，供后续新增或修订 skill 时参考。

> 整体 prompt 组合架构见 [architecture-section-prompts.md](./architecture-section-prompts.md)。

## 1. 概念区分

| 概念 | 路径 | 用途 |
|------|------|------|
| **Section Prompt** | `prompts/sections/section.{type}.md` | 按 section 类型（hero、features、pricing 等）提供基础生成指导 |
| **Component Skill** | `prompts/skills/component.{sectionType}.{variant}.md` | 在 section 类型下，按设计意图选择更细粒度的实现技能 |

**工作流**：`generateSection` 会加载 `section.default` + `section.{type}`，再根据 section 上下文通过 LLM 选择并注入一个 Component Skill 的完整内容。

---

## 2. Component Skill 结构

### 2.1 文件命名

```
component.{sectionType}.{variant}.md
```

- `sectionType`：必须与 `sectionTypes` 中的值一致（如 `hero`、`features`）
- `variant`：技能变体名（如 `lighting`、`dashboard`、`editorial`）

示例：`component.hero.lighting.md`、`component.hero.dashboard.md`

### 2.2 YAML Frontmatter（必填）

```yaml
---
id: component.{sectionType}.{variant}   # 必须与文件名一致（不含 .md）
kind: component-skill
sectionTypes: ["hero"]                  # 适用的 section 类型，可多个
priority: 75                            # 数字越大越优先，同匹配时取高者
fallback: false                         # 是否作为兜底技能（无匹配时使用）
when:
  designKeywords:
    any: ["lightning", "shader", "webgl"]
    none: []
  traits:
    any: ["ambient", "centered"]
    none: []
  journeyStages:
    any: ["acquisition", "campaign"]
    none: []
  productTypes:
    any: ["marketing-site", "saas-app"]
    none: []
notes: |
  简短描述（约 80 字符内），供 LLM 选择时参考。
---
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| `id` | 唯一标识，与文件名对应 |
| `sectionTypes` | 该 skill 适用的 section 类型 |
| `priority` | 多个 skill 同时匹配时，取 priority 最高者 |
| `fallback` | 至少一个 hero skill 应设为 `true`，作为无匹配时的兜底 |
| `when.*.any` | 满足任一即视为匹配 |
| `when.*.none` | 满足任一则排除 |
| `notes` | 会被截断到约 80 字符，用于 LLM 选择 |

### 2.3 正文结构（推荐）

```markdown
# Component Skill: {SectionType} — {VariantName}

Use this skill when...

## Design Principles
1. **原则一** — 说明
2. **原则二** — 说明

## Structure Requirements
- **Headline**: 要求
- **Subheading**: 要求
- **CTA block**: 要求
- ...

## Layout Patterns
- **模式一**: 说明
- **模式二**: 说明

## Typography Hierarchy
- `font-display` → 用途
- `font-header` → 用途
- `font-body` → 用途
- `font-label` → 用途

## Visual Impact
- 颜色、对比、层次、动效等

## Technical Requirements（如需要）
- Client/Server
- 依赖
- 特殊 API

## Constraints
- Output only raw TSX
- 其他硬性约束

## Implementation Reference（如需要）
- 关键组件/模式说明
- 代码片段（shader、复杂逻辑等）
```

### 2.4 约束要点

- **输出格式**：仅输出 raw TSX，无 markdown 代码块、无注释性文字
- **组件形态**：默认 Server Component；需要 hooks、framer-motion、WebGL 等时加 `"use client"`
- **设计系统**：使用 `app/globals.css` 中的 token，不在此处定义 `@font-face`、`@keyframes`
- **文案**：使用真实、符合上下文的文案，禁止占位符

---

## 3. Section Prompt 结构

### 3.1 文件命名与自动发现

```
section.{type}.md
```

采用约定式发现：存在 `section.{type}.md` 即使用，不存在则回退到 `section.default`。**无需手动注册**。

### 3.2 正文结构（推荐）

```markdown
## Section Prompt: Generate {Type} Section

You are...

## Required Structure
1. 结构要素一
2. 结构要素二
...

## Layout Guidance
- 布局建议

## Rules
- 输出规则
- 导入规则
- 设计系统应用
```

### 3.3 与 Component Skill 的关系

- **Section Prompt**：定义该 section 类型的通用要求（结构、布局、规则）
- **Component Skill**：在通用要求之上，提供针对特定设计意图的细化指导（如 hero 下的 lighting、dashboard、editorial）

两者会一起注入到 `generateSection` 的 system prompt 中。

---

## 4. 新增 Skill 检查清单

- [ ] 文件名 `component.{sectionType}.{variant}.md`
- [ ] Frontmatter 含 `id`、`sectionTypes`、`priority`、`fallback`、`when`、`notes`
- [ ] `id` 与文件名一致（不含 .md）
- [ ] `when` 的 `any`/`none` 合理，避免过度匹配或从不匹配
- [ ] 至少一个同类型 skill 的 `fallback: true`（若此为兜底）
- [ ] 正文含 Design Principles、Structure Requirements、Layout Patterns、Typography、Constraints
- [ ] 如需复杂实现（WebGL、shader 等），提供 Implementation Reference

---

## 6. 新增 Section 类型检查清单

- [ ] 创建 `prompts/sections/section.{type}.md`（存在即生效，无需注册）
- [ ] 新建 Component Skill 时，`sectionTypes` 包含新类型

---

## 7. 参考实现

| 技能 | 用途 |
|------|------|
| `component.hero.impactful` | 通用高冲击 hero，fallback |
| `component.hero.dashboard` | 产品/数据 dashboard 风格 hero |
| `component.hero.editorial` | 杂志/叙事风格 hero |
| `component.hero.lighting` | WebGL 闪电/光效 hero |

---

## 8. 附录：Skill 选择流程

```
1. discoverSkillsBySectionType(root, section.type)
   → 得到 sectionTypes 包含 type 的 skills，按 priority 降序

2. LLM 选择
   → 输入：section context + candidate metadata
   → 输出：{ id: "component.hero.xxx" } 或 { id: null }

3. Fallback
   → 若 id 为 null 或无效，取 fallback:true 且 priority 最高者

4. 加载
   → loadSkillPrompt(id) 得到完整 prompt 正文
   → 注入到 generateSection 的 system prompt
```
