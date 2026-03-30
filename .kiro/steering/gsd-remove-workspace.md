---
inclusion: manual
---

# gsd-remove-workspace

Remove a GSD workspace and clean up worktrees

## 目标

Remove a workspace directory after confirmation. For worktree strategy, runs `git worktree remove` for each member repo first. Refuses if any repo has uncommitted changes.

## 上下文

**Arguments:**
- `<workspace-name>` (required) — Name of the workspace to remove

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/remove-workspace.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute the remove-workspace workflow from @.cursor/get-shit-done/workflows/remove-workspace.md end-to-end.
