---
inclusion: manual
---

# gsd-insert-phase

Insert urgent work as decimal phase (e.g., 72.1) between existing phases

## 目标

Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.

## 上下文

Arguments: (用户提供的参数) (format: <after-phase-number> <description>)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/insert-phase.md]]

## 执行流程

Execute the insert-phase workflow from @.cursor/get-shit-done/workflows/insert-phase.md end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).
