---
inclusion: manual
---

# gsd-review

Request cross-AI peer review of phase plans from external AI CLIs

## 目标

Invoke external AI CLIs (Gemini, Claude, Codex) to independently review phase plans.
Produces a structured REVIEWS.md with per-reviewer feedback that can be fed back into
planning via /gsd-plan-phase --reviews.

**Flow:** Detect CLIs → Build review prompt → Invoke each CLI → Collect responses → Write REVIEWS.md

## 上下文

Phase number: extracted from (用户提供的参数) (required)

**Flags:**
- `--gemini` — Include Gemini CLI review
- `--claude` — Include Claude CLI review (uses separate session)
- `--codex` — Include Codex CLI review
- `--all` — Include all available CLIs

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/review.md]]

## 执行流程

Execute the review workflow from @.cursor/get-shit-done/workflows/review.md end-to-end.
