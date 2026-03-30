---
inclusion: manual
---

# gsd-forensics

Post-mortem investigation for failed GSD workflows — analyzes git history, artifacts, and state to diagnose what went wrong

## 目标

Investigate what went wrong during a GSD workflow execution. Analyzes git history, `.planning/` artifacts, and file system state to detect anomalies and generate a structured diagnostic report.

Purpose: Diagnose failed or stuck workflows so the user can understand root cause and take corrective action.
Output: Forensic report saved to `.planning/forensics/`, presented inline, with optional issue creation.

## 上下文

**Data sources:**
- `git log` (recent commits, patterns, time gaps)
- `git status` / `git diff` (uncommitted work, conflicts)
- `.planning/STATE.md` (current position, session history)
- `.planning/ROADMAP.md` (phase scope and progress)
- `.planning/phases/*/` (PLAN.md, SUMMARY.md, VERIFICATION.md, CONTEXT.md)
- `.planning/reports/SESSION_REPORT.md` (last session outcomes)

**User input:**
- Problem description: (用户提供的参数) (optional — will ask if not provided)

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/forensics.md]]

## 执行流程

Read and execute the forensics workflow from @.cursor/get-shit-done/workflows/forensics.md end-to-end.

## 成功标准

- Evidence gathered from all available data sources
- At least 4 anomaly types checked (stuck loop, missing artifacts, abandoned work, crash/interruption)
- Structured forensic report written to `.planning/forensics/report-{timestamp}.md`
- Report presented inline with findings, anomalies, and recommendations
- Interactive investigation offered for deeper analysis
- GitHub issue creation offered if actionable findings exist
