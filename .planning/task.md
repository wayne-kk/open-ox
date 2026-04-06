# Modify Agent 架构升级任务清单

> 基于 Claude Code 架构对标分析，按优先级排列
> 已完成项标记 ✅，待做项标记 ⬜
> 最后更新: 2026-04-05

---

## 已完成 ✅

### 模型路由解耦
- ✅ modify 流程不再依赖全局 `_runtimeModelId`，model 通过函数参数直接传递
- ✅ 前端 modify 请求不再盲目传 `selectedModel`
- ✅ `MODIFY_DEFAULT_MODEL: "claude-opus-4-6"` 正确生效

### Agent Loop 核心改进
- ✅ System Prompt 加入 Thinking Protocol + Core Principles（Claude Code Section 3/7）
- ✅ 4-Phase Progressive Workflow（Orient → Deep Read → Edit → Verify）
- ✅ Anti-Patterns 部分（明确告诉 LLM 什么行为是打转）
- ✅ Loop Detection（连续 4 次操作同一文件时注入策略转换提示）
- ✅ Stop Hook 升级（build 失败 + 编辑次数 > 6 时提示根因分析 + revert）

### 工具能力补全
- ✅ `exec_shell` 加入 modify 工具列表
- ✅ `read_file` 支持 `start_line`/`end_line` 行范围读取
- ✅ `think` 工具（内部推理 scratchpad，无副作用）
- ✅ `revert_file` 工具（基于 FileSnapshotTracker 快照回滚）
- ✅ `parallel_tool_calls: true` 启用并行工具调用
- ✅ Tool Result Budget（单条结果上限 30K 字符）

### 工具安全 + 上下文管理
- ✅ "Must read before edit" 保护
- ✅ edit_file 失败时的近似行匹配诊断
- ✅ 基于相关性的 Context 压缩（热文件保留，冷文件压缩）
- ✅ 文件读取追踪 + 会话清理

---

## P0: 核心架构升级

### 1. ⬜ 动态 System Prompt 组装流水线

**对标**: Claude Code `getSystemPrompt()` — 多 section 动态组装 + 缓存边界

**现状**: 单个硬编码 `SYSTEM_PROMPT` 字符串，所有内容混在一起，无法按项目/会话动态调整

**目标**: 拆分为可独立更新的 sections，支持项目级指令注入

**具体任务**:
