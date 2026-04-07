# 架构迁移：capabilityAssistIds 白名单 → Traits 结构化系统

> 日期：2026-04-07
> 范围：ai/flows/generate_project 全链路 + 文档 + skill 元数据

---

## 1. 为什么要改

旧架构的核心问题是把**质量约束**和**创意空间**混在了同一个白名单机制里。

### 旧架构的瓶颈

```
planProject.ts 向 LLM 发送：
  ## Allowed Capability Assist IDs
  - effect.motion.subtle
  - effect.motion.ambient
  - effect.motion.energetic
  - pattern.hero.split
  - pattern.hero.centered
  - pattern.hero.editorial
  - pattern.hero.dashboard
  - pattern.features.grid
  - pattern.pricing.three-tier
  - pattern.faq.two-column

LLM 只能从这 10 个 ID 中选择 → 系统能力上限 = 10
```

具体表现：

- 每新增一种 hero 样式，必须手写 `.md` 文件 + 注册到白名单
- `inferCapabilityAssistIds()` 用正则匹配关键词来硬编码映射
- `getCapabilityAssistPath()` 用三层 fallback 解析 ID → 文件路径
- LLM 的角色被压缩成"从菜单里点菜"，无法表达菜单之外的设计意图

### 新架构的核心转变

```
旧：LLM 从 N 个预定义选项中选 → 能力上限 = N
新：LLM 在 schema 约束内自由生成 → 能力上限 = LLM 的能力
```

分层原则：

| 层 | 机制 | 变化 |
|----|------|------|
| Guardrails（质量约束） | 白名单（文件系统扫描） | **不变** |
| Traits（创意空间） | 结构化 schema | **新增，替代 capabilityAssistIds** |
| Skills（组件技能） | 文件系统扫描 + LLM 选择 | **when 条件从旧 ID 改为 trait 关键词** |

---

## 2. 类型系统变更

### 2.1 删除的类型

```typescript
// ❌ 已删除
export type CapabilityAssistId = string;
```

### 2.2 新增的类型（types.ts）

```typescript
export interface LayoutTrait {
  type: string;       // "split", "centered", "editorial", "grid", "comparison"...
  ratio?: string;     // "60/40", "50/50"
  direction?: string; // "ltr", "rtl"
  note?: string;
}

export interface MotionTrait {
  intensity: string;  // "subtle" | "ambient" | "energetic" | "none"
  trigger?: string;   // "viewport-enter", "hover", "load", "scroll"
  note?: string;
}

export interface VisualTrait {
  density?: string;   // "sparse", "dense", "balanced"
  contrast?: string;  // "high", "low", "medium"
  style?: string;     // "geometric", "organic", "typographic", "photographic"
  note?: string;
}

export interface InteractionTrait {
  mode?: string;      // "cta-focused", "explorative", "passive", "data-driven"
  note?: string;
}

export interface SectionTraits {
  layout?: LayoutTrait;
  motion?: MotionTrait;
  visual?: VisualTrait;
  interaction?: InteractionTrait;
}
```

### 2.3 SectionDesignPlan 字段变更

```typescript
// 旧
interface SectionDesignPlan {
  // ...其他字段不变
  guardrailIds: GuardrailId[];
  capabilityAssistIds: CapabilityAssistId[];  // ❌ 已删除
  constraints: string[];
}

// 新
interface SectionDesignPlan {
  // ...其他字段不变
  guardrailIds: GuardrailId[];
  traits: SectionTraits;                      // ✅ 新增
  constraints: string[];
}
```

---

## 3. 逐文件变更清单

### 3.1 核心类型与规划

| 文件 | 变更 |
|------|------|
| `ai/flows/generate_project/types.ts` | 删除 `CapabilityAssistId`，新增 `LayoutTrait`/`MotionTrait`/`VisualTrait`/`InteractionTrait`/`SectionTraits`，`SectionDesignPlan.capabilityAssistIds` → `traits` |
| `ai/flows/generate_project/planners/defaultProjectPlanner.ts` | `inferCapabilityAssistIds()` → `inferTraits()`，返回 `SectionTraits` 对象而非 `string[]` |
| `ai/flows/generate_project/steps/planProject.ts` | 验证函数 `isSectionDesignPlan` 中 `isStringArray(candidate.capabilityAssistIds)` → `isTraitsObject(candidate.traits)`；user message 中删除白名单列表，改为发送 traits schema 和示例 |
| `ai/flows/generate_project/planners/guardrailPolicy.ts` | **无变更** — guardrails 保持白名单机制 |

### 3.2 生成与组装

| 文件 | 变更 |
|------|------|
| `ai/flows/generate_project/steps/generateSection.ts` | 删除 `hasCapabilityAssist`/`loadCapabilityAssist` 导入；`buildCapabilityBlocks()` → `buildTraitsBlock()`（从 traits 对象内联生成 Markdown，不再查文件）；user message 中 `Capability Assist IDs` → `Traits` |
| `ai/flows/generate_project/steps/composePage.ts` | section brief 中 `Capability Assists: ids.join()` → `Traits: JSON.stringify(traits)` |
| `ai/flows/generate_project/steps/selectComponentSkills.ts` | section context 中 `capabilityAssistIds` → `traits` |

### 3.3 Skill 元数据

| 文件 | 变更 |
|------|------|
| `ai/shared/skillDiscovery.ts` | `SkillWhenCondition.capabilityAssists` → `traits` |
| 全部 14 个 `prompts/skills/*.md` | frontmatter 中 `capabilityAssists` → `traits`，值从旧 ID（如 `pattern.hero.split`）改为 trait 关键词（如 `split`） |

### 3.4 共享文件

| 文件 | 变更 |
|------|------|
| `ai/flows/generate_project/shared/files.ts` | 删除 `CAPABILITY_PROMPTS_ROOT`、`getCapabilityAssistPath()`、`hasCapabilityAssist()`、`loadCapabilityAssist()` |

### 3.5 Re-exports

| 文件 | 变更 |
|------|------|
| `ai/flows/generate_project/index.ts` | 删除 `CapabilityAssistId` 导出，新增 `LayoutTrait`/`MotionTrait`/`VisualTrait`/`InteractionTrait`/`SectionTraits` |
| `ai/flows/index.ts` | 同上 |
| `ai/index.ts` | 同上 |

### 3.6 Prompt 文件

| 文件 | 变更 |
|------|------|
| `prompts/steps/planProject.md` | JSON 示例中 `capabilityAssistIds` → `traits`；规则说明从"选白名单 ID"改为"在 schema 内自由生成" |
| `prompts/skills/component.hero.impactful.md` | 正文中 `effect.motion.ambient or effect.motion.energetic is in capability assists` → `section traits specify ambient or energetic motion` |

### 3.7 文档页面（app/docs/）

| 文件 | 变更 |
|------|------|
| `app/docs/pipeline/page.tsx` | 步骤 03 描述"能力增强"→"结构化特征（traits）"；步骤 07 同理；prompt 分层图中 `capability assists` → `traits block` |
| `app/docs/section-generation/page.tsx` | `capabilityAssistIds` → `traits` |
| `app/docs/generate-project-trace/page.tsx` | TOC 标签、§3 system 拼接顺序、§4 user 消息、§5 整节从"capabilityAssistIds → 文件"重写为"traits → 内联提示" |

### 3.8 仓库文档（docs/）

| 文件 | 变更 |
|------|------|
| `docs/architecture.md` | `capabilityAssistIds` → `traits` 描述；prompt 分层图更新 |
| `docs/architecture-core.md` | "按需附加 capability assist" → "按需附加 traits"；运行时堆栈图更新；"仍然保留的"列表更新 |
| `docs/architecture-section-prompts.md` | 第 5 层从 `Capability assists` → `Traits`；§3 从"Capability assists（与 guardrail 区分）"重写为"Traits（与 guardrail 区分）" |
| `docs/architecture-skill-selector.md` | `capabilityAssists` → `traits`；示例 JSON 更新 |
| `docs/section-skill-rules.md` | frontmatter 示例中 `capabilityAssists` → `traits` |

---

## 4. 数据流对比

### 旧流程

```
planProject
  ├─ user message 列出 10 个 Allowed Capability Assist IDs
  ├─ LLM 从中选择 → capabilityAssistIds: ["pattern.hero.split", "effect.motion.ambient"]
  └─ 合并到 SectionDesignPlan

generateSection
  ├─ buildCapabilityBlocks(designPlan)
  │   ├─ hasCapabilityAssist("pattern.hero.split") → true
  │   ├─ getCapabilityAssistPath("pattern.hero.split")
  │   │   └─ pattern.* → prompts/layouts/hero.split.md
  │   └─ loadCapabilityAssist → 读文件内容
  └─ 拼入 system prompt
```

### 新流程

```
planProject
  ├─ user message 发送 traits schema + 示例
  ├─ LLM 自由生成 → traits: { layout: { type: "split", ratio: "60/40" }, motion: { intensity: "ambient" } }
  └─ 合并到 SectionDesignPlan（traits 是 object，无需白名单校验）

generateSection
  ├─ buildTraitsBlock(designPlan.traits)
  │   └─ 从 traits 对象内联生成 Markdown：
  │       ## Section Traits
  │       ### Layout: split (60/40)
  │       ### Motion: ambient on load
  └─ 拼入 system prompt（无文件 I/O）
```

---

## 5. 关键实现细节

### 5.1 inferTraits()（替代 inferCapabilityAssistIds）

旧函数用正则匹配关键词，返回固定 ID 字符串数组。新函数同样用正则匹配，但返回结构化的 `SectionTraits` 对象：

```typescript
function inferTraits(section: SectionSpec, context: PlanningContext): SectionTraits {
  const haystack = `${section.intent} ${section.contentHints} ${context.designKeywords.join(" ")}`.toLowerCase();
  const traits: SectionTraits = {};

  // Motion trait — 从关键词推断动效强度
  if (/(neon|cyber|festival|bold|energetic|glow|glitch)/.test(haystack)) {
    traits.motion = { intensity: "energetic", trigger: "load" };
  } else if (/(editorial|minimal|luxury|calm|clean)/.test(haystack)) {
    traits.motion = { intensity: "subtle", trigger: "viewport-enter" };
  }

  // Layout trait — 从 section 类型和关键词推断布局
  if (section.type === "hero") {
    if (/(dashboard|saas|terminal|metrics)/.test(haystack)) {
      traits.layout = { type: "product-led", note: "Product-led hero with visual evidence" };
    } else {
      traits.layout = { type: "split", ratio: "60/40", direction: "ltr" };
    }
  }

  // Visual trait — 从关键词推断视觉风格
  if (/(neon|cyber|glow|dark|dramatic)/.test(haystack)) {
    traits.visual = { contrast: "high", style: "geometric" };
  }

  return traits;
}
```

关键区别：旧函数的输出是离散的、有限的（10 个 ID）；新函数的输出是连续的、可组合的。而且这只是 **default fallback** — 当 LLM 的 planProject 输出被成功解析时，会使用 LLM 生成的 traits，不走这个函数。

### 5.2 buildTraitsBlock()（替代 buildCapabilityBlocks）

旧函数从文件系统加载 `.md` 文件拼接。新函数从 traits 对象内联生成：

```typescript
function buildTraitsBlock(traits: SectionTraits): string {
  if (!traits || Object.keys(traits).length === 0) return "";
  const lines: string[] = ["## Section Traits"];

  if (traits.layout) {
    const l = traits.layout;
    lines.push(`### Layout: ${l.type}${l.ratio ? ` (${l.ratio})` : ""}`);
    if (l.note) lines.push(`- ${l.note}`);
  }
  if (traits.motion) {
    lines.push(`### Motion: ${traits.motion.intensity}${traits.motion.trigger ? ` on ${traits.motion.trigger}` : ""}`);
  }
  if (traits.visual) {
    const parts = [traits.visual.density, traits.visual.contrast && `${traits.visual.contrast} contrast`, traits.visual.style].filter(Boolean);
    if (parts.length > 0) lines.push(`### Visual: ${parts.join(", ")}`);
  }
  if (traits.interaction?.mode) {
    lines.push(`### Interaction: ${traits.interaction.mode}`);
  }
  return lines.join("\n");
}
```

优势：零文件 I/O，无白名单限制，LLM 可以表达任意组合。

### 5.3 planProject user message 变更

旧：发送 10 个固定 ID 列表
新：发送 schema 定义 + 示例

```
## Traits Schema (replaces capability assist IDs)
traits: {
  layout?: { type: string, ratio?: string, direction?: string, note?: string }
  motion?: { intensity: "subtle"|"ambient"|"energetic"|"none", trigger?: string, note?: string }
  visual?: { density?: string, contrast?: string, style?: string, note?: string }
  interaction?: { mode?: string, note?: string }
}

Examples:
- Hero split: { layout: { type: "split", ratio: "60/40" }, motion: { intensity: "ambient" } }
- Dashboard hero: { layout: { type: "product-led" }, visual: { style: "data-driven" } }
- Empty/default: {} (when no specific traits are needed)
```

### 5.4 Skill when 条件迁移

旧：匹配固定的 capability assist ID

```yaml
when:
  capabilityAssists:
    any: ["pattern.hero.split", "pattern.hero.centered", "effect.motion.subtle"]
    none: ["effect.motion.energetic"]
```

新：匹配 trait 关键词（更灵活，不依赖 ID 命名空间）

```yaml
when:
  traits:
    any: ["split", "centered", "subtle"]
    none: ["energetic"]
```

注意：`when` 条件只作为 metadata 传给 LLM 做 skill 选择，没有程序化匹配逻辑。所以这个变更是纯数据层面的。

---

## 6. 不变的部分

以下机制完全不受影响：

- **Guardrail 白名单**：`guardrailPolicy.ts` 的扫描、合并、默认推断逻辑不变
- **Skill 发现与选择**：`discoverSkillsBySectionType()` 仍按 `sectionTypes` 过滤，`preselectSkillsForSections()` 仍做批量 LLM 选择
- **Skill 正文加载**：`loadSkillPrompt()` 不变
- **Section prompt 选择**：`selectSectionPromptId()` 不变
- **构建、修复、依赖安装**：`runBuild`、`repairBuild`、`installDependencies` 不变
- **Checkpoint/Resume**：checkpoint 机制不变

---

## 7. 已废弃但未删除的文件

以下文件不再被代码引用，但保留在仓库中作为参考：

```
prompts/capabilities/pattern.hero.dashboard.md
prompts/capabilities/pattern.hero.editorial.md
prompts/layouts/hero.split.md
prompts/layouts/hero.centered.md
prompts/layouts/features.grid.md
prompts/layouts/pricing.three-tier.md
prompts/layouts/faq.two-column.md
prompts/motions/motion.subtle.md
prompts/motions/motion.ambient.md
prompts/motions/motion.energetic.md
```

这些文件之前通过 `getCapabilityAssistPath()` 的三层 fallback 被加载。现在 `buildTraitsBlock()` 完全内联生成提示文本，不再需要文件查找。可以安全删除，或保留作为 skill 编写时的参考素材。

---

## 8. 向后兼容性

- **已持久化的 blueprint**：如果数据库或日志中存有旧格式的 `PlannedProjectBlueprint`（含 `capabilityAssistIds`），`isSectionDesignPlan()` 验证会失败，导致 `planProject` 回退到 `defaultPlan`。这是安全的 — 旧数据会被重新规划。
- **Checkpoint resume**：如果 checkpoint 缓存了旧格式的 blueprint，resume 时 `planProject` 步骤会被重新执行（因为 `cachedBlueprint` 的 section designPlan 结构不匹配）。这也是安全的。
- **外部消费者**：如果有外部代码 import 了 `CapabilityAssistId` 类型，会得到编译错误。需要迁移到 `SectionTraits`。

---

## 9. 验证

- `npx tsc --noEmit` — 零错误
- 所有 11 个核心 TypeScript 文件通过 `getDiagnostics` 检查
- 所有文档页面（`.tsx`）通过 `getDiagnostics` 检查
- 全局搜索 `capabilityAssistIds` / `CapabilityAssistId` — 仅剩迁移说明文本中的引用
