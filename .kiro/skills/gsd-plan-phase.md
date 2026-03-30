---
inclusion: manual
---

# gsd-plan-phase

Create detailed phase plan (PLAN.md) with verification loop

## 目标

Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gsd-planner, verify with gsd-plan-checker, iterate until pass or max iterations, present results.

## 上下文

Phase number: (用户提供的参数) (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop
- `--prd <file>` — Use a PRD/acceptance criteria file instead of discuss-phase. Parses requirements into CONTEXT.md automatically. Skips discuss-phase entirely.
- `--reviews` — Replan incorporating cross-AI review feedback from REVIEWS.md (produced by `/gsd-review`)
- `--text` — Use plain-text numbered lists instead of TUI menus (required for `/rc` remote sessions)

Normalize phase input in step 2 before any directory lookups.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/plan-phase.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute the plan-phase workflow from @.cursor/get-shit-done/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
