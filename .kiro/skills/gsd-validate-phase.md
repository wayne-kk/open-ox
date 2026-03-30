---
inclusion: manual
---

# gsd-validate-phase

Retroactively audit and fill Nyquist validation gaps for a completed phase

## 目标

Audit Nyquist validation coverage for a completed phase. Three states:
- (A) VALIDATION.md exists — audit and fill gaps
- (B) No VALIDATION.md, SUMMARY.md exists — reconstruct from artifacts
- (C) Phase not executed — exit with guidance

Output: updated VALIDATION.md + generated test files.

## 上下文

Phase: (用户提供的参数) — optional, defaults to last completed phase.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/validate-phase.md]]

## 执行流程

Execute @.cursor/get-shit-done/workflows/validate-phase.md.
Preserve all workflow gates.
