# 四、System Prompt 的缓存分裂

> 核心源码：`src/utils/queryContext.ts`、`src/constants/prompts.ts`、`src/constants/systemPromptSections.ts`、`src/utils/api.ts`

## 概述

Claude Code 的系统提示词被精心设计为三层结构，以最大化 Anthropic API 的 prompt cache 命中率。核心挑战是：系统提示词中既有跨用户/跨组织可共享的静态内容，也有用户特定的动态内容。缓存分裂（cache fragmentation）会导致每次请求都重新计算整个提示词，浪费大量 token。

## 教学导读：Prompt Cache 是 Claude Code 的"省钱引擎"

Anthropic API 的 prompt cache 机制是这样的：如果两次请求的系统提示词前缀完全相同（逐字节匹配），第二次请求可以复用第一次的计算结果，token 费用降低 90%。

对于 Claude Code 来说，每个 Agent turn 都是一次 API 请求。一个会话可能有 50+ 个 turn。如果每次都重新计算 ~50K token 的系统提示词，成本是巨大的。但如果能让这 50 次请求共享同一个缓存前缀，成本就降低了一个数量级。

**核心挑战**：系统提示词不是静态的。它包含用户的 CLAUDE.md、当前的 git 状态、MCP 工具列表、记忆索引……这些内容每个用户都不同，甚至同一个用户在不同时间也不同。如何在"个性化"和"缓存命中"之间找到平衡？

答案就是**三部分架构 + 边界标记**。

```typescript
// src/utils/queryContext.ts
async function fetchSystemPromptParts({
  tools, mainLoopModel, additionalWorkingDirectories, mcpClients, customSystemPrompt
}): Promise<{
  defaultSystemPrompt: string[]    // 第一部分：默认系统提示词
  userContext: { [k: string]: string }  // 第二部分：用户上下文
  systemContext: { [k: string]: string } // 第三部分：系统上下文
}>
```

### 第一部分：defaultSystemPrompt（静态，可全局缓存）

由 `getSystemPrompt()` 构建，包含：

```
1. 简介（模型身份、输出风格）
2. 系统规则（工具使用、权限、钩子）
3. 任务执行指南
4. 行动准则（可逆性、爆炸半径）
5. 工具使用指南
6. ═══ SYSTEM_PROMPT_DYNAMIC_BOUNDARY ═══  ← 缓存边界标记
7. 会话特定指南（Agent 工具、技能发现）
8. 环境信息（OS、CWD、日期）
9. MCP 工具说明
10. 记忆系统提示词
```

**关键设计**：`SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 标记将提示词分为两半：
- 标记之前：跨组织可缓存（`scope: 'global'`）
- 标记之后：用户/会话特定

### 第二部分：userContext（用户级，跨 turn 缓存）

```typescript
const userContext = {
  ...baseUserContext,           // getUserContext() 返回
  ...coordinatorUserContext,    // Coordinator 模式注入
}
```

包含：
- CLAUDE.md 文件内容
- 用户偏好设置
- 记忆系统的 MEMORY.md 索引
- Coordinator 模式的 Worker 管理指令

### 第三部分：systemContext（系统级）

```typescript
const systemContext = getSystemContext()
```

包含：
- Git 状态信息
- 项目结构摘要
- 环境变量

## 缓存边界标记

```typescript
// src/constants/prompts.ts
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'
```

这个标记被 `src/utils/api.ts` 的 `splitSysPromptPrefix` 和 `src/services/api/claude.ts` 的 `buildSystemPromptBlocks` 使用：

```typescript
// src/utils/api.ts
function splitSysPromptPrefix(systemPrompt: string[]): {
  staticPrefix: string[]   // 可用 scope:'global' 缓存
  dynamicSuffix: string[]  // 用户特定
}
```

API 请求中的 system prompt 被构建为多个 `cache_control` 块：

```json
[
  { "type": "text", "text": "静态前缀...", "cache_control": { "type": "ephemeral" } },
  { "type": "text", "text": "动态后缀..." }
]
```

当 `shouldUseGlobalCacheScope()` 返回 true 时，静态前缀使用 `scope: 'global'`，允许跨组织共享缓存。

## systemPromptSection 缓存机制

`src/constants/systemPromptSections.ts` 实现了一个 section 级别的缓存：

```typescript
// 每个 section 只计算一次，结果被缓存
const memorySection = systemPromptSection('memory', async () => {
  return await loadMemoryPrompt()
})

// 危险版本：不缓存，每次都重新计算
const envSection = DANGEROUS_uncachedSystemPromptSection('env', () => {
  return getEnvironmentInfo()
})
```

`resolveSystemPromptSections()` 并行解析所有 section，然后按顺序拼接。

## 缓存分裂的来源

### 已解决的分裂

1. **会话类型**：`isNonInteractiveSession` 曾在静态前缀中，现在移到动态后缀
2. **Agent 工具指南**：`isForkSubagentEnabled()` 读取会话状态，移到 `getSessionSpecificGuidanceSection`
3. **输出风格**：`outputStyleConfig` 保留在静态前缀（身份定义），但评估中

### 仍存在的分裂因素

1. **模型名称**：不同模型的提示词不同（Opus vs Sonnet 的输出效率指南）
2. **工具集**：MCP 工具不同导致工具说明不同
3. **USER_TYPE**：`ant` vs `external` 有大量条件分支
4. **Feature flags**：GrowthBook 的 A/B 测试导致不同用户看到不同提示词

## CacheSafeParams：缓存安全参数

```typescript
// src/utils/forkedAgent.ts
type CacheSafeParams = {
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext
  forkContextMessages: Message[]
}
```

这个结构被传递给所有需要共享缓存的子系统：
- 自动压缩（`compactConversation`）
- 子代理（`runForkedAgent`）
- 侧问题（`buildSideQuestionFallbackParams`）

子代理通过 `renderedSystemPrompt` 字段直接复用父进程的提示词字节，避免重新构建导致的缓存失效：

```typescript
// src/tools/AgentTool/forkSubagent.ts
// 父进程在 turn 开始时冻结 systemPrompt
// 子代理直接使用这个冻结的副本
// 避免 GrowthBook cold→warm 导致的字节差异
```

## Prompt Cache Break Detection

```typescript
// src/services/api/promptCacheBreakDetection.ts
// 监控 cache_read_input_tokens 的变化
// 当缓存命中率突然下降时，记录 tengu_prompt_cache_break 事件
// 帮助诊断缓存分裂问题
```

## 关键设计决策与工程权衡

1. **三层分离**：静态/用户/系统三层，最大化缓存复用。静态层跨所有用户共享，用户层跨同一用户的所有 turn 共享，系统层每次可能变化。

2. **边界标记**：显式标记而非隐式约定，防止意外移动导致缓存失效。源码注释警告："Do not remove or reorder this marker without updating cache logic"。

3. **Section 缓存**：每个 section 独立缓存，避免重复计算。但有一个 `DANGEROUS_uncachedSystemPromptSection` 变体用于必须每次重新计算的内容（如环境信息），命名中的 "DANGEROUS" 是故意的——提醒开发者这会影响性能。

4. **子代理缓存共享**：通过冻结 systemPrompt 字节，子代理复用父进程的缓存。这是一个"**时间换空间**"的权衡——冻结意味着子代理看不到 GrowthBook 的最新值，但缓存命中带来的成本节省远大于这个代价。

5. **缓存中断检测**：主动监控 `cache_read_input_tokens` 的变化。当缓存命中率突然下降时，记录 `tengu_prompt_cache_break` 事件。这是一个"**可观测性驱动的优化**"——你无法优化你看不到的东西。

6. **工具 Schema 缓存**：`toolSchemaCache.ts` 缓存每个工具的 API schema（name + description + input_schema），防止 GrowthBook 的 feature flag 翻转导致 schema 字节变化。这是一个非常微妙的缓存分裂来源——一个 flag 从 false 变成 true 可能会在工具描述中多一句话，导致整个工具数组的字节变化，进而导致缓存失效。
