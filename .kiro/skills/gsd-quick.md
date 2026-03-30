---
inclusion: manual
---

# gsd-quick

Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents

## 目标

Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking).

Quick mode is the same system with a shorter path:
- Spawns gsd-planner (quick mode) + gsd-executor(s)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

**Default:** Skips research, discussion, plan-checker, verifier. Use when you know exactly what to do.

**`--discuss` flag:** Lightweight discussion phase before planning. Surfaces assumptions, clarifies gray areas, captures decisions in CONTEXT.md. Use when the task has ambiguity worth resolving upfront.

**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

**`--research` flag:** Spawns a focused research agent before planning. Investigates implementation approaches, library options, and pitfalls for the task. Use when you're unsure of the best approach.

Flags are composable: `--discuss --research --full` gives discussion + research + plan-checking + verification.

## 上下文

(用户提供的参数)

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/quick.md]]

## 执行流程

Execute the quick workflow from @.cursor/get-shit-done/workflows/quick.md end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).
