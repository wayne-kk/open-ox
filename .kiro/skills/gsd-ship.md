---
inclusion: manual
---

# gsd-ship

Create PR, run review, and prepare for merge after verification passes

## 目标

Bridge local completion → merged PR. After /gsd-verify-work passes, ship the work: push branch, create PR with auto-generated body, optionally trigger review, and track the merge.

Closes the plan → execute → verify → ship loop.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/ship.md]]
