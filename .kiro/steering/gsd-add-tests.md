---
inclusion: manual
---

# gsd-add-tests

Generate tests for a completed phase based on UAT criteria and implementation

## 目标

Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications.

Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Output: Test files committed with message `test(phase-{N}): add unit and E2E tests from add-tests command`

## 上下文

Phase: (用户提供的参数)

@.planning/STATE.md
@.planning/ROADMAP.md

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/add-tests.md]]

## 执行流程

Execute the add-tests workflow from @.cursor/get-shit-done/workflows/add-tests.md end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).
