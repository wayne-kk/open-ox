---
inclusion: manual
---

# gsd-pr-branch

Create a clean PR branch by filtering out .planning/ commits — ready for code review

## 目标

Create a clean branch suitable for pull requests by filtering out .planning/ commits
from the current branch. Reviewers see only code changes, not GSD planning artifacts.

This solves the problem of PR diffs being cluttered with PLAN.md, SUMMARY.md, STATE.md
changes that are irrelevant to code review.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/pr-branch.md]]

## 执行流程

Execute the pr-branch workflow from @.cursor/get-shit-done/workflows/pr-branch.md end-to-end.
