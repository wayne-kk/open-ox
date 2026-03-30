---
inclusion: manual
---

# gsd-check-todos

List pending todos and select one to work on

## 目标

List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Routes to the check-todos workflow which handles:
- Todo counting and listing with area filtering
- Interactive selection with full context loading
- Roadmap correlation checking
- Action routing (work now, add to phase, brainstorm, create phase)
- STATE.md updates and git commits

## 上下文

Arguments: (用户提供的参数) (optional area filter)

Todo state and roadmap correlation are loaded in-workflow using `init todos` and targeted reads.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/check-todos.md]]

## 执行流程

**Follow the check-todos workflow** from `@.cursor/get-shit-done/workflows/check-todos.md`.

The workflow handles all logic including:
1. Todo existence checking
2. Area filtering
3. Interactive listing and selection
4. Full context loading with file summaries
5. Roadmap correlation checking
6. Action offering and execution
7. STATE.md updates
8. Git commits
