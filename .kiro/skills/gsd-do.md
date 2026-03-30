---
inclusion: manual
---

# gsd-do

Route freeform text to the right GSD command automatically

## 目标

Analyze freeform natural language input and dispatch to the most appropriate GSD command.

Acts as a smart dispatcher — never does the work itself. Matches intent to the best GSD command using routing rules, confirms the match, then hands off.

Use when you know what you want but don't know which `/gsd-*` command to run.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/do.md]]
- #[[file:.cursor/get-shit-done/references/ui-brand.md]]

## 执行流程

Execute the do workflow from @.cursor/get-shit-done/workflows/do.md end-to-end.
Route user intent to the best GSD command and invoke it.
