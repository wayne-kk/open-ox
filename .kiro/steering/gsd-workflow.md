---
inclusion: auto
---

# GSD (Get Shit Done) 工作流引擎

本项目使用 GSD 工作流系统管理项目规划、执行和调试。工作流定义文件位于 `.cursor/get-shit-done/` 目录。

## 工具适配（Cursor → Kiro）

在执行 GSD 工作流时，将 Cursor 工具映射为 Kiro 等价操作：
- Cursor `Shell` → Kiro `executeBash`
- Cursor `StrReplace` → Kiro `strReplace`
- Cursor `Read` → Kiro `readFile` / `readCode`
- Cursor `Write` → Kiro `fsWrite`
- Cursor `Glob` → Kiro `fileSearch`
- Cursor `Grep` → Kiro `grepSearch`
- Cursor `Task(subagent_type=...)` → Kiro `invokeSubAgent(name="general-task-execution", ...)`
- Cursor `WebSearch` → Kiro `remote_web_search`
- Cursor `WebFetch` → Kiro `webFetch`

## 子代理映射

GSD 工作流中的 subagent 类型统一通过 Kiro 的 `invokeSubAgent` 调用：
- `gsd-debugger` → `invokeSubAgent(name="general-task-execution", prompt=<debug prompt>)`
- `gsd-planner` → `invokeSubAgent(name="general-task-execution", prompt=<planning prompt>)`
- `gsd-executor` → `invokeSubAgent(name="general-task-execution", prompt=<execution prompt>)`
- 其他 GSD agent → `invokeSubAgent(name="general-task-execution", prompt=<agent-specific prompt>)`

## 用户交互

当工作流需要用户输入时：
- 以编号列表呈现选项
- 请用户回复选择
- 多选时请求逗号分隔的编号

## 可用 Skills

所有 GSD skills 位于 `.kiro/skills/` 目录，用户可通过 `#` 在聊天中引用。
Figma 相关 skills: `figma-use`, `figma-generate-design`

## 关键路径

- 工作流定义: `.cursor/get-shit-done/workflows/`
- 参考文档: `.cursor/get-shit-done/references/`
- 模板: `.cursor/get-shit-done/templates/`
- 工具脚本: `.cursor/get-shit-done/bin/gsd-tools.cjs`
- 项目规划: `.planning/`
