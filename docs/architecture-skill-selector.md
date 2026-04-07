# Component Skill Selector 架构设计

## 1. 设计目标

- **无限可配置**：新增 skill 只需添加 `.md` 文件，无需改代码
- **Metadata 驱动**：LLM 仅基于 metadata 选择，不读取 prompt 正文
- **Token 高效**：与 OpenClaw 一致，只注入紧凑的 capability 描述
- **可审计**：能力边界清晰，可版本控制

## 2. 参考：OpenClaw 的 Skill 设计

| 维度 | OpenClaw | 本方案 |
|------|----------|--------|
| 能力定义 | TOOLS.md / SKILLS.md 列举 name + description | 每个 skill 的 YAML frontmatter |
| LLM 输入 | 紧凑 XML：name, description, location | 紧凑 JSON：id, sectionTypes, when, notes |
| 扩展方式 | 安装 skill → 更新 SKILLS.md | 新增 .md 文件 → 自动发现 |
| Token 成本 | ~97 chars + 字段长度 / skill | 仅 metadata，不含 prompt 正文 |

**核心原则**：LLM 只看到「菜单」，不看到「菜谱」。选择基于 metadata，执行时再加载完整 prompt。

## 3. 现有 Skill 结构（已具备）

```yaml
---
id: component.hero.impactful
kind: component-skill
sectionTypes: ["hero"]
priority: 50
fallback: true
when:
  designKeywords: { any: [...], none: [] }
  traits: { any: [...], none: [] }
  journeyStages: { any: [...], none: [] }
  productTypes: { any: [...], none: [] }
notes: |
  Default high-impact hero skill. Use for energetic, bold...
---
# 正文：完整设计指导（LLM 选择阶段不读取）
```

metadata 已足够支撑选择逻辑，无需传 prompt 正文。

## 4. 架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Skill Discovery（无状态）                                │
│  - 扫描 prompts/skills/*.md                                       │
│  - 解析 YAML frontmatter → SkillMetadata[]                        │
│  - 按 sectionTypes 建立索引                                       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Candidate Filtering（纯 metadata）                       │
│  - 输入：section.type                                             │
│  - 输出：sectionTypes 包含 type 的 skills                         │
│  - 无 LLM 调用                                                     │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: LLM Selection（metadata-only）                          │
│  - 输入：section context (JSON) + candidate metadata (JSON[])     │
│  - 输出：{ id: string | null }                                    │
│  - 不传 prompt 正文，仅传 id/sectionTypes/priority/fallback/when/notes │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Fallback（规则兜底）                                    │
│  - LLM 返回 null 或无效 id                                        │
│  - 取 fallback:true 且 sectionTypes 匹配、priority 最高者          │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Prompt Loading（执行阶段）                              │
│  - 根据选定 id 加载完整 loadSkillPrompt(id)                        │
│  - 注入到 generateSection 的 system prompt                        │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Metadata 与 LLM 的交互设计

### 5.1 传给 LLM 的 Skill 结构（紧凑）

```json
{
  "id": "component.hero.impactful",
  "sectionTypes": ["hero"],
  "priority": 50,
  "fallback": true,
  "when": {
    "designKeywords": { "any": ["acid", "neon", "festival"], "none": [] },
    "traits": { "any": ["centered"], "none": [] },
    "journeyStages": { "any": ["acquisition", "campaign"], "none": [] },
    "productTypes": { "any": ["marketing-site"], "none": [] }
  },
  "notes": "Default high-impact hero. Use for energetic, bold heroes."
}
```

- 不传 `kind`（内部用）
- `notes` 截断为单行，约 80 字符
- 总大小约 200–400 字符/skill，远小于传 80 行 prompt

### 5.2 传给 LLM 的 Section Context

```json
{
  "type": "hero",
  "intent": "High-impact entry for Cyber-Night Halloween 2024",
  "contentHints": "festival, neon, cyberpunk",
  "traits": { "layout": { "type": "centered" }, "motion": { "intensity": "energetic" } },
  "designKeywords": ["neon", "cyberpunk", "festival"],
  "productType": "campaign-site",
  "journeyStage": "campaign"
}
```

### 5.3 LLM 输出格式

```json
{ "id": "component.hero.impactful" }
```

或

```json
{ "id": null }
```

单次调用，单值输出，便于解析与兜底。

### 5.4 System Prompt（精简）

```
You are a component skill selector. Given a section to generate and a list of candidate skills (metadata only), pick the single best skill id, or null if none fit.

Rules:
- Match only when section context clearly aligns with skill's when.*.any fields.
- Prefer higher priority when multiple skills match.
- Return null if no skill is a good fit.
- Respond with JSON only: {"id": "component.hero.xxx"} or {"id": null}

Do not invent skill ids. Only return ids from the candidate list.
```

## 6. 实现清单（已完成）

| 模块 | 职责 | 实现 |
|------|------|------|
| `ai/shared/skillDiscovery.ts` | **通用** 扫描、解析、过滤 | `discoverSkills(rootPath)`, `discoverSkillsBySectionType(rootPath, type)`, `toCompactMetadata()`, `loadSkillContent(rootPath, id)` |
| `selectComponentSkills.ts` | metadata-only LLM + fallback | 使用 discovery 获取候选，仅传 metadata 给 LLM，输出 `{ id }`，无效时取 fallback |
| `componentSkillSelector.ts` | 已删除 | 由 discovery + fallback 替代 |
| `generateSection.ts` | 接入新选择器 | 调用 `stepSelectComponentSkills` → `loadSelectedSkillPrompt(result.id)` |

## 7. 扩展性

- **新增 skill**：在 `prompts/skills/` 下添加 `component.hero.xxx.md`，写好 frontmatter 即可，无需改代码
- **新增 section 类型**：在 skill 的 `sectionTypes` 中加入新类型，discovery 自动纳入
- **调整匹配逻辑**：改 `when` 结构或 system prompt，不动 discovery 与加载逻辑

## 8. 与当前实现的差异

| 当前实现 | 本设计 |
|----------|--------|
| `COMPONENT_SKILL_IDS` 硬编码 hero 候选 | discovery 自动扫描，无硬编码 |
| 传 80 行 prompt 给 LLM | 只传 metadata，约 200–400 字符/skill |
| `stepSelectComponentSkills` 返回 `selected[]` | 返回 `{ id }`，单值 |
| 无 fallback 规则 | 有 metadata 驱动的 fallback |
