---
inclusion: manual
---

# gsd-new-project

Initialize a new project with deep context gathering and PROJECT.md

## 目标

Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**
- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

**After this command:** Run `/gsd-plan-phase 1` to start execution.

## 上下文

**Flags:**
- `--auto` — Automatic mode. After config questions, runs research → requirements → roadmap without further interaction. Expects idea document via @ reference.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/new-project.md]]
- #[[file:.cursor/get-shit-done/references/questioning.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]
- #[[file:.cursor/get-shit-done/templates/project.md]]
- #[[file:.cursor/get-shit-done/templates/requirements.md]]

## 执行流程

Execute the new-project workflow from @.cursor/get-shit-done/workflows/new-project.md end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
