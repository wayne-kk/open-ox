---
inclusion: manual
---

# gsd-settings

Configure GSD workflow toggles and model profile

## 目标

Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive 5-question prompt (model, research, plan_check, verifier, branching)
- Config merging and writing
- Confirmation display with quick command references

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/settings.md]]

## 执行流程

**Follow the settings workflow** from `@.cursor/get-shit-done/workflows/settings.md`.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display
