---
inclusion: manual
---

# gsd-plan-milestone-gaps

Create phases to close all gaps identified by milestone audit

## 目标

Create all phases necessary to close gaps identified by `/gsd-audit-milestone`.

Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase.

One command creates all fix phases — no manual `/gsd-add-phase` per gap.

## 上下文

**Audit results:**
Glob: .planning/v*-MILESTONE-AUDIT.md (use most recent)

Original intent and current planning state are loaded on demand inside the workflow.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/plan-milestone-gaps.md]]

## 执行流程

Execute the plan-milestone-gaps workflow from @.cursor/get-shit-done/workflows/plan-milestone-gaps.md end-to-end.
Preserve all workflow gates (audit loading, prioritization, phase grouping, user confirmation, roadmap updates).
