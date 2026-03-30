---
inclusion: manual
---

# gsd-autonomous

Run all remaining phases autonomously — discuss→plan→execute per phase

## 目标

Execute all remaining milestone phases autonomously. For each phase: discuss → plan → execute. Pauses only for user decisions (grey area acceptance, blockers, validation requests).

Uses ROADMAP.md phase discovery and Skill() flat invocations for each phase command. After all phases complete: milestone audit → complete → cleanup.

**Creates/Updates:**
- `.planning/STATE.md` — updated after each phase
- `.planning/ROADMAP.md` — progress updated after each phase
- Phase artifacts — CONTEXT.md, PLANs, SUMMARYs per phase

**After:** Milestone is complete and cleaned up.

## 上下文

Optional flag: `--from N` — start from phase N instead of the first incomplete phase.

Project context, phase list, and state are resolved inside the workflow using init commands (`gsd-tools.cjs init milestone-op`, `gsd-tools.cjs roadmap analyze`). No upfront context loading needed.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/autonomous.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute the autonomous workflow from @.cursor/get-shit-done/workflows/autonomous.md end-to-end.
Preserve all workflow gates (phase discovery, per-phase execution, blocker handling, progress display).
