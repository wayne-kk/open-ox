---
inclusion: manual
---

# gsd-health

Diagnose planning directory health and optionally repair issues

## 目标

Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/health.md]]

## 执行流程

Execute the health workflow from @.cursor/get-shit-done/workflows/health.md end-to-end.
Parse --repair flag from arguments and pass to workflow.
