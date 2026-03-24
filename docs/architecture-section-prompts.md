# Section 生成 Prompt 架构

本文档描述 `generateSection` 的 prompt 组合模型、Guardrail 体系及扩展指南。

## 1. Prompt 组合顺序

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: System (frontend)                                     │
│  - 全局 AI 行为、角色设定                                         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Section Base                                          │
│  - section.default：通用 section 要求、Tech Stack、Output Rules   │
│  - section.{type}：类型专属结构、布局、规则（hero/features/...）  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Component Skill（可选）                                │
│  - 由 LLM 根据 section context 选择                               │
│  - 提供更细粒度的设计指导（如 hero.lighting、hero.dashboard）      │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Guardrails                                             │
│  - project.*：项目级约束                                          │
│  - section.*：Section 级原子约束                                  │
│  - outputTsx：输出格式                                           │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Capability Assists（可选）                             │
│  - pattern.*：布局变体（如 pattern.hero.centered）                 │
│  - effect.motion.*：动效风格（如 effect.motion.ambient）           │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Guardrail 分层

### 2.1 项目级 (projectGuardrailIds)

| ID | 说明 |
|----|------|
| `project.consistency` | 视觉语言、typography、间距、组件样式跨 section 一致 |
| `project.accessibility` | 对比度、语义结构、交互可及性、motion 兼容 reduced-motion |

### 2.2 Section 级 (designPlan.guardrailIds)

由 `inferGuardrailIds` 为每个 section 推断，按类型补充：

| ID | 适用 | 说明 |
|----|------|------|
| `section.core` | 全部 | 自包含、无 props、真实内容、生产级、响应式、语义 HTML |
| `section.accessibility` | 全部 | 语义地标、标题、可及性属性 |
| `section.layout` | 全部 | 双层结构（Outer/Inner）、区块分隔禁止项 |
| `section.typography` | 全部 | font-display/header/body/label 层级与用法 |
| `section.styles` | 全部 | 禁止组件内定义全局样式，复用 globals.css |
| `section.above-fold` | hero, navigation | 首屏优化 |
| `section.interactive` | pricing, faq, navigation | 交互元素规范 |

### 2.3 输出级

| ID | 说明 |
|----|------|
| `outputTsx` | 仅输出 raw TSX，无 markdown 围栏、无注释，包含完整 imports |

## 3. 未来方向：Section Prompt 的 Skill 化

当前 section prompt 采用约定式发现（存在即用，无则 default）。后续可演进为与 Component Skill 类似的形式：

- 多个 `section.{type}.{variant}.md` 变体
- 基于 metadata 的 LLM 模糊匹配
- 无需硬编码 type → prompt 映射

届时 section prompt 选择逻辑可与 `selectComponentSkills` 对齐。

## 4. 设计原则

### 3.1 原子性 (Atomicity)

- 每个 guardrail 只负责单一关切
- 避免大而全的 rule，便于复用与组合

### 3.2 去重 (DRY)

- 通用约束放在 guardrail，不在 section prompt 中重复
- section.{type} 仅保留**类型专属**内容

### 3.3 扩展性

- **新增 section 类型**：新增 `section.{type}.md` 即可，存在即生效，无需注册
- **新增约束**：新增 `rules/section.{concern}.md` → 在 `inferGuardrailIds` 中加入
- **新增 component skill**：新增 `skills/component.{type}.{variant}.md` → frontmatter 正确即可

## 5. 各层职责

| 层 | 职责 | 不应包含 |
|----|------|----------|
| section.default | Tech Stack、输出格式、Server/Client 默认、导入导出 | 类型专属结构、字体/样式细则（→ guardrail） |
| section.{type} | Required Structure、Layout Guidance、类型专属 Rules | "Output only raw TSX"、"no props"（→ 已由 guardrail 覆盖） |
| Component Skill | Design Principles、Structure、Layout、Typography 变体、Technical 要求 | 与 guardrail 重复的通用约束 |
| Guardrail | 硬性约束、原子规则 | 设计建议、可变指导 |

## 6. 文件索引

```
prompts/
├── sections/
│   ├── section.default.md      # 通用 base
│   ├── section.hero.md
│   ├── section.features.md
│   └── ...
├── skills/
│   ├── component.hero.lighting.md
│   └── ...
└── rules/
    ├── section.core.md
    ├── section.accessibility.md
    ├── section.layout.md
    ├── section.typography.md   # 字体层级
    ├── section.styles.md       # 全局样式复用
    ├── section.above-fold.md
    ├── section.interactive.md
    ├── outputTsx.md
    ├── project.consistency.md
    └── project.accessibility.md
```

## 7. 与 section-skill-rules 的关系

- **section-skill-rules.md**：侧重 Component Skill 与 Section Prompt 的编写规范
- **本文档**：侧重 generateSection 的 prompt 组合架构、Guardrail 体系与扩展流程
