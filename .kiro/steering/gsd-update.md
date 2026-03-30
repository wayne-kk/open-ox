---
inclusion: manual
---

# gsd-update

Update GSD to latest version with changelog display

## 目标

Check for GSD updates, install if available, and display what changed.

Routes to the update workflow which handles:
- Version detection (local vs global installation)
- npm version checking
- Changelog fetching and display
- User confirmation with clean install warning
- Update execution and cache clearing
- Restart reminder

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/update.md]]

## 执行流程

**Follow the update workflow** from `@.cursor/get-shit-done/workflows/update.md`.

The workflow handles all logic including:
1. Installed version detection (local/global)
2. Latest version checking via npm
3. Version comparison
4. Changelog fetching and extraction
5. Clean install warning display
6. User confirmation
7. Update execution
8. Cache clearing
