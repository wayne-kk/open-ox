---
inclusion: manual
---

# gsd-manager

Interactive command center for managing multiple phases from one terminal

## 目标

Single-terminal command center for managing a milestone. Shows a dashboard of all phases with visual status indicators, recommends optimal next actions, and dispatches work — discuss runs inline, plan/execute run as background agents.

Designed for power users who want to parallelize work across phases from one terminal: discuss a phase while another plans or executes in the background.

**Creates/Updates:**
- No files created directly — dispatches to existing GSD commands via Skill() and background Task agents.
- Reads `.planning/STATE.md`, `.planning/ROADMAP.md`, phase directories for status.

**After:** User exits when done managing, or all phases complete and milestone lifecycle is suggested.

## 上下文

No arguments required. Requires an active milestone with ROADMAP.md and STATE.md.

Project context, phase list, dependencies, and recommendations are resolved inside the workflow using `gsd-tools.cjs init manager`. No upfront context loading needed.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/manager.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute the manager workflow from @.cursor/get-shit-done/workflows/manager.md end-to-end.
Maintain the dashboard refresh loop until the user exits or all phases complete.
