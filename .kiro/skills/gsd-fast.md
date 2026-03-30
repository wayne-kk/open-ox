---
inclusion: manual
---

# gsd-fast

Execute a trivial task inline — no subagents, no planning overhead

## 目标

Execute a trivial task directly in the current context without spawning subagents
or generating PLAN.md files. For tasks too small to justify planning overhead:
typo fixes, config changes, small refactors, forgotten commits, simple additions.

This is NOT a replacement for /gsd-quick — use /gsd-quick for anything that
needs research, multi-step planning, or verification. /gsd-fast is for tasks
you could describe in one sentence and execute in under 2 minutes.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/fast.md]]

## 执行流程

Execute the fast workflow from @.cursor/get-shit-done/workflows/fast.md end-to-end.
