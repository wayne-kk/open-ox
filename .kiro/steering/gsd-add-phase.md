---
inclusion: manual
---

# gsd-add-phase

Add phase to end of current milestone in roadmap

## 目标

Add a new integer phase to the end of the current milestone in the roadmap.

Routes to the add-phase workflow which handles:
- Phase number calculation (next sequential integer)
- Directory creation with slug generation
- Roadmap structure updates
- STATE.md roadmap evolution tracking

## 上下文

Arguments: (用户提供的参数) (phase description)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/add-phase.md]]

## 执行流程

**Follow the add-phase workflow** from `@.cursor/get-shit-done/workflows/add-phase.md`.

The workflow handles all logic including:
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates
