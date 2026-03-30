---
inclusion: manual
---

# gsd-audit-uat

Cross-phase audit of all outstanding UAT and verification items

## 目标

Scan all phases for pending, skipped, blocked, and human_needed UAT items. Cross-reference against codebase to detect stale documentation. Produce prioritized human test plan.

## 上下文

Core planning files are loaded in-workflow via CLI.

**Scope:**
Glob: .planning/phases/*/*-UAT.md
Glob: .planning/phases/*/*-VERIFICATION.md

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/audit-uat.md]]
