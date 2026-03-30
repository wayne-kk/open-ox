---
inclusion: manual
---

# gsd-ui-phase

Generate UI design contract (UI-SPEC.md) for frontend phases

## 目标

Create a UI design contract (UI-SPEC.md) for a frontend phase.
Orchestrates gsd-ui-researcher and gsd-ui-checker.
Flow: Validate → Research UI → Verify UI-SPEC → Done

## 上下文

Phase number: (用户提供的参数) — optional, auto-detects next unplanned phase if omitted.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/ui-phase.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute @.cursor/get-shit-done/workflows/ui-phase.md end-to-end.
Preserve all workflow gates.
