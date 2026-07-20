# 看见再锁：气质 + 结构同屏 · 实现说明

**版本**：v0.1  
**日期**：2026-07-19  
**状态**：已实现（默认开启；`DIRECTION_LOCK_V1=0` / `NEXT_PUBLIC_DIRECTION_LOCK_V1=0` 关闭）  
**关联**：

- 调研：[`docs/research/ai-builder-generation-quality-levers-20260719.md`](../research/ai-builder-generation-quality-levers-20260719.md)
- 结构 PRD：[`generate-blueprint-preview-v0.1-prd.md`](./generate-blueprint-preview-v0.1-prd.md)
- 气质想法：[`attraction-ideas-20260713.md`](./attraction-ideas-20260713.md) §2.2

---

## 1. 用户路径

```text
clarify / options
  → confirm_brief
  → single_page_ia_proposal → confirm_direction（同屏：气质三选一 + SiteOutline 编辑）
  → 用户点「确认气质与结构并生成」
  → forceDirectionLockCommit 入队 generate_project
```

- 气质区：默认 `VibeLayoutShell`（centered / split / editorial）；可选「换一批布局」→ HTML iframe。
- 结构区：低保真灰块 `SiteOutlineEditor`（不套 vibe 色）。
- 早期 clarify 上的 `VibePickerPanel` 仅在 flag 关闭时保留。

---

## 2. 关键契约

| 字段 | 位置 |
|------|------|
| `confirmedDesignDirectionMarkdown` / `Keywords` / `styleGuide` | `GenerationRunPayloadBody`（已有） |
| `confirmedSiteOutline` | 同上；`outlineToSectionSpecs` → home sections |
| `confirmedLayoutVariantId` | 同上；追加进 Style Guide hint |

管线：`runGenerateProject` 在 plan 前 `applyConfirmedSiteOutlineToBlueprint`；`plan_project` **保留** prior sections，不再写死 `[]`。

---

## 3. 关键文件

| 区域 | 路径 |
|------|------|
| 类型 | `lib/studio/siteOutline.ts`、`lib/studio/layoutVariant.ts`、`lib/generation/types.ts` |
| Intent | `intentAgent/tools.ts`、`runIntentAgentTurn.ts`、`singlePageIaProposalTool.ts`、`projectIntentAgent.md` |
| Studio | `DirectionLockPanel.tsx`、`VibeLayoutShell.tsx`、`SiteOutlineEditor.tsx`、`BuildConversation.tsx`、`useBuildStudio.ts` |
| API | `POST /api/projects/[id]/vibe-directions`、`POST .../vibe-layout-preview`、`forceDirectionLockCommit` on intent-agent |
| 管线 | `applyConfirmedSiteOutline.ts`、`runGenerateProject.ts`、`planProject.ts` |

---

## 4. Flag

| 环境变量 | 作用 |
|----------|------|
| `DIRECTION_LOCK_V1=0` | 服务端关闭（Intent 不挂 IA / confirm_direction） |
| `NEXT_PUBLIC_DIRECTION_LOCK_V1=0` | 客户端关闭（恢复早期 vibe picker） |

默认：**开启**。

---

## 5. 验收对照

1. 默认路径生成前出现同屏门；未选气质或 modules 为空时主 CTA disabled。  
2. 三方向默认壳布局可区分。  
3. 「换一批布局」失败不挡确认（回退壳）。  
4. 首次生成 section 类型/顺序与确认 outline 一致。  
5. 确认气质写入 design-intent / styleGuide。  
6. flag 关闭时行为回退旧路径。
