# 调研：Studio 视觉拓展方向（2026-07-07 修订）

**状态**：随 PRD v0.4 更新 — Style Pack 取消；聚焦 Design Mode + Image Reference。

---

## 选定方向

| P0 | 名称 | 一句话 |
|----|------|--------|
| **A** | Design Mode Lite | Preview 点选改样式 → Modify 草稿 → build |
| **B** | Image Reference Pipeline | 多图 + 结构化视觉分析 → 更忠实实现（借鉴 image-to-code） |

**不做**：Style Pack、Hero 动效 preset。

---

## 方向 A · Design Mode

对标 [v0 Design Mode](https://v0.app/docs/design-mode)：点选、面板、Apply 进版本/Modify。Open-OX 差异：Apply 必须走 Modify Agent + build。

---

## 方向 B · Image Reference（对标 image-to-code）

Open-OX 现状：单张 `referenceImageDataUrl`、`screenshotIntentMode`、guardrails。

image-to-code 可借鉴、且适合 **产品化进流水线** 的要点：

1. **一 section 一图** → 用户多图 + sectionTag  
2. **先分析再实现** → `visualReferenceAnalysis` artifact  
3. **faithful / anti-drift** → 加强 per-page vision + fidelity UI  
4. **看不清补图** → analysis gaps + Studio 引导  

不在 v0.4 做：流水线内 Agent 自动生成 section mock（仍可用外部 Codex + image-to-code skill）。

Skill 文档：`.agents/skills/image-to-code/USAGE.md`

---

## 参考

- v0 Design Mode: https://v0.app/docs/design-mode  
- Open-OX: `screenshotIntentMode.ts`, `userVisionContent.ts`, `runGenerateProject.ts`  
