---
inclusion: manual
---

# gsd-new-milestone

Start a new milestone cycle — update PROJECT.md and route to requirements

## 目标

Start a new milestone: questioning → research (optional) → requirements → roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements → roadmap cycle.

**Creates/Updates:**
- `.planning/PROJECT.md` — updated with new milestone goals
- `.planning/research/` — domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` — scoped requirements for this milestone
- `.planning/ROADMAP.md` — phase structure (continues numbering)
- `.planning/STATE.md` — reset for new milestone

**After:** `/gsd-plan-phase [N]` to start execution.

## 上下文

Milestone name: (用户提供的参数) (optional - will prompt if not provided)

Project and milestone context files are resolved inside the workflow (`init new-milestone`) and delegated via `<files_to_read>` blocks where subagents are used.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/new-milestone.md]]
- #[[file:.cursor/get-shit-done/references/questioning.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]
- #[[file:.cursor/get-shit-done/templates/project.md]]
- #[[file:.cursor/get-shit-done/templates/requirements.md]]

## 执行流程

Execute the new-milestone workflow from @.cursor/get-shit-done/workflows/new-milestone.md end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
