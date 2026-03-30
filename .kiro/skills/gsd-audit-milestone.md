---
inclusion: manual
---

# gsd-audit-milestone

Audit milestone completion against original intent before archiving

## 目标

Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

**This command IS the orchestrator.** Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

## 上下文

Version: (用户提供的参数) (optional — defaults to current milestone)

Core planning files are resolved in-workflow (`init milestone-op`) and loaded only as needed.

**Completed Work:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/audit-milestone.md]]

## 执行流程

Execute the audit-milestone workflow from @.cursor/get-shit-done/workflows/audit-milestone.md end-to-end.
Preserve all workflow gates (scope determination, verification reading, integration check, requirements coverage, routing).
