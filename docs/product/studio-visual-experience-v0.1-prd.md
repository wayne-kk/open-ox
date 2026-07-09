# Studio 视觉体验增强 · PRD

**版本**：v0.4  
**日期**：2026-07-07  
**状态**：草案（方向调整：Design Mode P0 + Image Reference 加强；Style Pack 取消）  
**关联调研**：[docs/research/studio-visual-extensions-20260707.md](../research/studio-visual-extensions-20260707.md)  
**Program**：**Design Mode Lite（P0-A）** + **Image Reference Pipeline（P0-B）**

> **产品边界**：不含 Style Pack Library、Hero skills / WebGL 动效 preset。  
> **Skill 参考**（Agent 侧，非本 PRD 实现范围）：[`.agents/skills/image-to-code/SKILL.md`](../../.agents/skills/image-to-code/SKILL.md)

---

## Problem Statement

Open-OX 已有「贴参考图 → 生成站点」能力，但体验与效果仍弱于用户预期：

| 现状 | 问题 |
|------|------|
| Studio 支持单张截图粘贴进 Intent | 一张图塞全站 → 模型看不清字号/间距/按钮细节 |
| `screenshotIntentMode` 区分复刻 vs 提取灵感 | 用户不会写「复刻/只要配色」；缺少 UI 显式选择 |
| 参考图传入 blueprint / design intent / page implement | **缺少结构化「先分析、再实现」** 的中间产物，易 design drift |
| 生成后改样式 | 只能靠 Modify 长 prompt |

用户需要：

1. **有参考图时**：像 image-to-code 一样 — **分析够深、按 section 对齐、实现尽量忠实**。  
2. **生成后**：在 preview **点选微调**（Design Mode），仍走 Modify + build。

---

## Solution（两个 P0 并行）

### P0-A · Design Mode Lite

在 live preview **点选元素** → 调色板 / slider 改 **color、font-size、padding、border-radius** → Apply 生成 **Modify 草稿** → 用户确认 → `runModifyProject` → build。

（详见下文「P0-A 规格」；原 P1 内容，优先级提升。）

### P0-B · Image Reference Pipeline（加强「根据图片生成」）

在现有 `referenceImageDataUrl` + `screenshotIntentMode` 链路上，产品化 **image-to-code 工作流中可落地的部分**（不依赖 Agent 侧自行生图的部分用「用户上传多图」替代）。

**核心顺序（写进流水线）**：

```
用户参考图（可多张、按 section 标注）
    → 视觉分析（结构化 extraction）
    → 写入 design-system + brief 附录 + 每页 implement 约束
    → page implement / build（faithful 模式）
    → （可选）Design Mode 微调
```

---

## 与 image-to-code skill 的借鉴映射

image-to-code 强调「生图 → 分析 → 实现」。Open-OX **不自建生图**时，用下表对齐：

| image-to-code 原则 | Open-OX 产品化（P0-B） |
|--------------------|-------------------------|
| 一 section 一图，不要一张长图塞全站 | Studio **多图上传**：Hero / Features / … 或「全页 + 自动提示拆 section」 |
| 看不清就补 detail 图，禁止 crop 旧图凑合 | UI 引导：**每 section 可追加一张**；分析 confidence 低时 prompt 用户补图 |
| 深度分析：文案、字体、间距、色、按钮 | 新增 **`visualReferenceAnalysis`** 步骤/artifact（JSON + 人类可读摘要） |
| 分析完再写代码 | Generate 流水线：**analysis 完成后再 page implement**（可 checkpoint） |
| faithful translation，anti-drift | 加强 `screenshotLayoutFidelity` guardrail + per-page vision context |
| Hero 极简、anti nested cards | 并入现有 section rules + analysis 输出「禁止项」提示 |
| IMPLEMENTATION_CLARITY / ANALYSIS_PRECISION 高 | Intent 里显式 ** fidelity 档位**（见下） |

**Open-OX 已有、保留并加强**：

- `resolveScreenshotIntentMode`（`replicate_layout` / `extract_inspiration`）
- `buildUserVisionContent`（vision + text）
- `referenceImageBase64` → design intent / page implement
- screenshot guardrails（`screenshotLayoutFidelity`, `screenshotExtractInspiration`）

**P0-B 新增（产品 + 流水线）**：

1. **Studio：参考图 UX**
   - 多图列表：每张图可选 `sectionTag`（hero / features / pricing / whole_page / other）
   - 显式 ** fidelity 开关**：「尽量还原版式」 vs 「只取配色/气质」（映射现有 mode，不用用户背关键词）
   - 分析前预览：用户确认「将按 N 张图分析」

2. **流水线：`stepAnalyzeVisualReferences`（名称待定）**
   - 输入：tagged images + merged brief + fidelity mode
   - 输出（持久化 artifact）：
     - `extractedCopy`：可读文案（headline、CTA、section titles）
     - `designTokens`：色板、字体 mood、radius/shadow/spacing 基调
     - `perSectionNotes`：每 section layout/hierarchy 摘要
     - `confidence` / `gaps`：哪些 section 需要补图
   - 下游：`design-system.md` merge、page implement 每页附带 **该页相关截图 + section notes**

3. **Per-page vision**
   - blueprint 每一页 implement 时，只 attach **匹配 sectionTag 的图**（+ whole_page 作 fallback），避免一张图糊全站

4. **Studio 可见性**
   - Intent 确认后 / generate 前：展示 **「视觉分析摘要」** 卡片（用户可改 brief 再生成）
   - topology 新 step：`visual_reference_analysis`

5. **（P0-B stretch，可选）**
   - Intent Agent 在 **无用户图** 且用户强调 visual 时，提示：「可上传参考图或分 section 上传」— 不强制 Agent 生图（生图留作后续 / 外部 Codex skill）

---

## User Stories

### P0-A · Design Mode Lite

1. 在 preview **点击元素**看到当前 styles。  
2. 用 **color / font-size / padding / radius** 控件微调。  
3. **Before/After** 后 Apply → **Modify 草稿** → 确认 → build。  
4. 支持 **撤销** 上一次 visual apply。  
5. visual edit 带 **文件/组件 hint**，减少 Modify 猜错。

### P0-B · Image Reference Pipeline

6. 上传 **多张**参考图并为每张选 **section 标签**。  
7. 用 UI 选择 **还原版式** vs **只取灵感**，不必写「复刻/配色」等黑话。  
8. 生成前看到 **视觉分析摘要**（文案、色板、各 section 要点）。  
9. 分析提示某 section **不清晰** 时，引导 **补传该 section 专用图**。  
10. 生成结果 **更贴近参考图**（layout fidelity 模式可测）。  
11. PM：记录 `reference_upload`、`fidelity_mode`、`analysis_completed` 事件。  
12. 失败时 **降级**：无 analysis 时走现有单图逻辑，不 block 生成。

### 跨切面

13. Design Mode 与参考图流程 **不破坏** preview/export。  
14. Ops：feature flag `STUDIO_DESIGN_MODE`、`STUDIO_VISUAL_REFERENCE_V2`。

---

## Implementation Decisions

### 分期（均为 P0，可拆开发）

| 泳道 | 建议顺序 | 周期粗估 |
|------|----------|----------|
| **P0-B-1** | 多图 + fidelity UI + 存 metadata | 1–2 周 |
| **P0-B-2** | `visualReferenceAnalysis` 步骤 + artifact | 2–3 周 |
| **P0-B-3** | Per-page vision + topology 展示 | 1–2 周 |
| **P0-A** | Design Mode overlay + Modify 草稿 | 3–4 周 |

P0-B 与 P0-A **可并行**；P0-B-1 不依赖 Design Mode。

### P0-A · Design Mode Lite（规格摘要）

- Preview overlay 点选；4 类 Tailwind-friendly 属性  
- **主路径（架构 v0.3）**：源坐标 `data-ox-source` → 服务端 AST Direct Apply → HMR（见 [studio-design-mode-source-writeback-architecture.md](./studio-design-mode-source-writeback-architecture.md)）  
- A 类不可 Direct：预检或失败后 **预填 Modify 草稿**（用户确认）；非 Apply 内静默 fallback  
- v1：单 breakpoint；不改 layout/DOM 结构  
- ADR：[0001-design-mode-source-coordinate-direct-apply.md](../adr/0001-design-mode-source-coordinate-direct-apply.md)

### P0-B · 数据与 API（概念）

- `project.referenceImages[]`: `{ id, dataUrl|storagePath, sectionTag, uploadedAt }`  
- `project.visualReferenceAnalysis`: analysis artifact 指针或 JSONB  
- `POST /api/projects/[id]/reference-images` — 增删改 tagged 图  
- `POST /api/projects/[id]/visual-analysis` — 触发/刷新分析（或合入 generate 前置 step）  
- Fidelity：`layout_fidelity` | `extract_inspiration`（对齐 `ScreenshotIntentMode`）

### Apply / 生成策略

- **不再使用 Style Pack**，无「换肤 regenerate」产品路径  
- 换视觉：**换参考图 + 重新分析 + regenerate**（用户确认），或 Modify / Design Mode 微调  
- 已有 `referenceImageDataUrl` 单字段：**迁移**为 `referenceImages[]`；只传一张时 `sectionTag=whole_page`

### 架构原则

- Harness 不变：analysis 是 **新 step**，不是绕过 build  
- immutable merge design-system  
- Analysis artifact 可进 Langfuse / generation_events 供调试  

---

## Testing Decisions

- **P0-B**：给定 tagged 多图 → analysis JSON 含 perSectionNotes；page implement 收到正确子集图  
- **P0-B**：fidelity UI 选择 → `resolveScreenshotIntentMode` 一致  
- **P0-A**：visual edit → Modify 草稿含 selector hint；build passed  
- 回归：无参考图时行为与现网一致（feature flag off）  

---

## Out of Scope

- Style Pack Library / 主题包 / token 画廊  
- Hero skills、WebGL、动效 preset、generate-visual-skill 产品化  
- 流水线内 **Agent 自动生成 section mockup 图**（v0.4 不做；用户上传为主）  
- Figma/Framer 级 canvas、拖拽版式  
- 无 Modify 确认的直接写文件  
- Design Mode 多 breakpoint 同步  

---

## 成功指标（P0 试点 4 周）

| 指标 | 目标 |
|------|------|
| 贴图用户 → 生成 ready 率 | vs 现网 baseline **相对 +5%** |
| 「版式还原」cohort 主观满意度 | N≥8 访谈，≥6/10 认为「像参考图」 |
| 多图上传率（≥2 张） | 贴图用户的 ≥30% |
| Design Mode Apply → Modify 成功率 | ≥ Studio Modify 基线 |
| analysis 步骤失败率 | <5%，且 fallback 不增 overall fail |

---

## 决策记录

| 日期 | 决策 |
|------|------|
| 2026-07-07 | 取消 Style Pack Library |
| 2026-07-07 | Design Mode Lite 提升为 **P0-A** |
| 2026-07-07 | 新增 **P0-B Image Reference Pipeline**，借鉴 image-to-code（用户多图 + 结构化分析） |
| 2026-07-07 | Hero skills / 动效不在范围内 |

---

## 附录：v0.3 → v0.4 变更

- 删除：Style Pack、style-packs API、全站换肤 regenerate（pack 触发）  
- 新增：多图 reference、visual analysis step、image-to-code 映射表  
- 调整：Design Mode 为 P0-A，与 P0-B 并列  
