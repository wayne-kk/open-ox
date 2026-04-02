# 七、五级上下文压缩

> 核心源码：`src/services/compact/`、`src/utils/toolResultStorage.ts`、`src/services/contextCollapse/`

## 教学导读：为什么"无限对话"需要五级压缩

Claude Code 的系统提示词告诉模型："The conversation has unlimited context through automatic summarization." 这句话背后是一个复杂的工程系统。

LLM 的上下文窗口是有限的（200K token，约 15 万字）。一个复杂的编程任务可能需要读取几十个文件、执行几十个命令，轻松超过这个限制。如果不压缩，用户会看到 "prompt too long" 错误，被迫手动 `/compact` 或开始新对话。

五级压缩的设计哲学是"**渐进式降级**"——先用最便宜、信息损失最小的方法，只有在不够时才升级到更昂贵、损失更大的方法：

```
信息保留度：高 ──────────────────────────────────→ 低
执行成本：  低 ──────────────────────────────────→ 高

Level 1: 工具结果预算    → 只裁剪单个超大结果，其余完整保留
Level 2: 历史截断        → 丢弃最老的消息，不生成摘要
Level 3: 微压缩          → 用占位符替换旧工具结果
Level 4: 上下文折叠      → 将连续读操作折叠为摘要
Level 5: 完整压缩        → 调用 API 生成整个对话的摘要
```

## 五级压缩管线

```
Level 1: Tool Result Budget（工具结果预算）
    ↓ 不够
Level 2: Snip Compact（历史截断）
    ↓ 不够
Level 3: Microcompact（微压缩 / 缓存编辑）
    ↓ 不够
Level 4: Context Collapse（上下文折叠）
    ↓ 不够
Level 5: Auto Compact（完整压缩）
    ↓ 仍然不够
Level 5b: Reactive Compact（响应式压缩，API 413 后触发）
```

## Level 1：Tool Result Budget

```typescript
// src/utils/toolResultStorage.ts
// 对超大工具结果进行磁盘持久化
// 替换为摘要 + 文件路径

// 每个工具有 maxResultSizeChars 限制
// 超过限制的结果被保存到磁盘
// Claude 收到的是预览 + 文件路径

// 例外：FileReadTool 的 maxResultSizeChars = Infinity
// 因为持久化会创建 Read→file→Read 循环
```

## Level 2：Snip Compact（HISTORY_SNIP）

```typescript
// src/services/compact/snipCompact.ts
// 截断最老的消息组，释放 token
// 不生成摘要，直接丢弃

// snipCompactIfNeeded(messages) → { messages, tokensFreed, boundaryMessage }

// 特点：
// - 按 API round 分组截断
// - 保留 compact boundary 之后的消息
// - UI 通过 snipProjection 保持完整历史的滚动回看
```

Snip 和 Microcompact 不互斥——两者可以在同一次迭代中都运行。

## Level 3：Microcompact

### 传统 Microcompact

```typescript
// src/services/compact/microCompact.ts
// 将旧的工具结果替换为简短摘要
// 不调用 API，纯本地操作

// 例如：
// 原始：{ tool_result: "文件内容...（5000 字符）" }
// 压缩后：{ tool_result: "[file content previously shown]" }
```

### 缓存 Microcompact（CACHED_MICROCOMPACT）

```typescript
// src/services/compact/cachedMCConfig.ts
// 利用 API 的 cache_control 机制
// 通过 cache editing 删除旧的工具结果
// 不需要重新发送整个上下文

// 流程：
// 1. 标记要删除的 tool_use_id
// 2. API 请求中使用 cache editing
// 3. 从 API 响应中获取 cache_deleted_input_tokens
// 4. 生成 microcompact boundary message
```

### 基于时间的配置

```typescript
// src/services/compact/timeBasedMCConfig.ts
// 根据消息年龄决定压缩策略
// 越老的消息越积极地压缩
```

## Level 4：Context Collapse（CONTEXT_COLLAPSE）

```typescript
// src/services/contextCollapse/
// 将连续的读/搜索操作折叠为摘要

// 三个文件：
// - index.ts: 入口，isContextCollapseEnabled(), applyCollapsesIfNeeded()
// - operations.ts: 折叠操作的实现
// - persist.ts: 折叠状态的持久化

// 特点：
// - 读时投影（read-time projection）：不修改原始消息
// - 摘要存储在 collapse store 中，不在 REPL 数组中
// - 跨 turn 持久化：projectView() 在每次入口重放 commit log
// - 90% 阈值开始折叠，95% 阈值阻塞新的 spawn
```

### 与 Auto Compact 的关系

Context Collapse 启用时，会抑制 Auto Compact：

```typescript
// autoCompact.ts
if (feature('CONTEXT_COLLAPSE') && isContextCollapseEnabled()) {
  return false  // 不触发 auto compact
}
```

原因：Collapse 是上下文管理系统，Auto Compact 在 90-95% 区间会与 Collapse 竞争，通常 Auto Compact 会赢，但会丢失 Collapse 保存的细粒度上下文。

### 溢出恢复

当 API 返回 413（prompt too long）时：

```typescript
// contextCollapse.recoverFromOverflow()
// 1. 排空所有暂存的折叠
// 2. 如果仍然不够，回退到 reactive compact
```

## Level 5：Auto Compact

### 触发条件

```typescript
function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS  // 13,000 tokens 缓冲
}

// 有效上下文窗口 = 模型上下文窗口 - 摘要输出预留（20,000 tokens）
// 例如：200K 模型 → 有效 180K → 阈值 167K
```

### 压缩流程

```typescript
async function compactConversation(messages, context, ...): Promise<CompactionResult> {
  // 1. 执行 pre-compact hooks
  // 2. 剥离图片和文档（stripImagesFromMessages）
  // 3. 剥离可重注入的附件（stripReinjectedAttachments）
  // 4. 调用 API 生成摘要（最多 20K output tokens）
  // 5. 如果 prompt too long，截断最老的消息组重试（最多 3 次）
  // 6. 构建 post-compact 消息
  // 7. 重注入文件状态、技能、Agent 列表、MCP 指令
  // 8. 执行 post-compact hooks
  // 9. 执行 post-compact cleanup
}
```

### Post-Compact 重注入

压缩后，以下内容被重新注入：

```typescript
POST_COMPACT_MAX_FILES_TO_RESTORE = 5        // 最多恢复 5 个文件
POST_COMPACT_TOKEN_BUDGET = 50_000            // 文件恢复总预算
POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000      // 每个文件最多 5K tokens
POST_COMPACT_MAX_TOKENS_PER_SKILL = 5_000     // 每个技能最多 5K tokens
POST_COMPACT_SKILLS_TOKEN_BUDGET = 25_000     // 技能恢复总预算
```

### 断路器

```typescript
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// 连续失败 3 次后停止重试
// 防止不可恢复的上下文在每个 turn 都浪费 API 调用
// BQ 数据：1,279 个会话曾有 50+ 次连续失败（最高 3,272 次）
```

### Recompaction 检测

```typescript
type RecompactionInfo = {
  isRecompactionInChain: boolean      // 是否在同一链中再次压缩
  turnsSincePreviousCompact: number   // 距上次压缩的 turn 数
  previousCompactTurnId?: string      // 上次压缩的 turn ID
  autoCompactThreshold: number        // 当前阈值
  querySource?: QuerySource           // 查询来源
}
```

## Level 5b：Reactive Compact

```typescript
// src/services/compact/reactiveCompact.ts
// 在 API 返回 prompt_too_long 后触发
// 与 auto compact 不同：reactive 是被动的，只在错误后触发

// 流程：
// 1. API 返回 413
// 2. 错误被扣留（withheld），不立即 yield
// 3. 尝试 reactive compact
// 4. 成功 → 用压缩后的消息重试
// 5. 失败 → yield 原始错误
```

### 媒体大小错误恢复

Reactive Compact 还处理媒体大小错误：

```typescript
// isWithheldMediaSizeError(message)
// 当图片/PDF 太大时，剥离媒体内容后重试
```

## 压缩管线的执行顺序

```typescript
// src/query.ts 中的每次迭代
messagesForQuery = await applyToolResultBudget(messagesForQuery, ...)  // Level 1
messagesForQuery = snipModule.snipCompactIfNeeded(messagesForQuery)     // Level 2
messagesForQuery = await deps.microcompact(messagesForQuery, ...)       // Level 3
messagesForQuery = await contextCollapse.applyCollapsesIfNeeded(...)    // Level 4
const { compactionResult } = await deps.autocompact(messagesForQuery, ...) // Level 5
```

## 关键设计决策与工程权衡

1. **渐进式压缩**：从轻量到重量，每级只在前一级不足时触发。这最大化了信息保留——如果 Level 1-3 就够了，用户的对话历史几乎完整保留。只有在极端情况下才会触发 Level 5 的完整摘要。

2. **缓存友好**：Microcompact 利用 API 缓存编辑，避免重新发送整个上下文。这是一个"**与 API 能力共同进化**"的设计——当 API 提供了新的缓存编辑能力，压缩系统立即利用它。

3. **读时投影**：Context Collapse 不修改原始消息，通过投影实现。这意味着 REPL 的 UI 仍然可以显示完整历史（用户可以滚动回看），只有发送给 API 的消息被折叠。这是"**展示层和数据层分离**"的体现。

4. **断路器**：连续失败 3 次后停止重试。这个数字来自生产数据——BQ 分析发现 1,279 个会话曾有 50+ 次连续失败（最高 3,272 次），每次失败都浪费一次 API 调用。断路器把浪费从 3,272 次降到 3 次。

5. **重注入**：压缩后重新注入关键上下文（最近的文件状态、技能、Agent 列表、MCP 指令）。这解决了"压缩后模型失忆"的问题——模型不记得自己刚才读了哪些文件，需要重新注入最重要的那几个。但重注入有严格的 token 预算（50K），防止重注入本身导致上下文再次爆炸。

6. **双路径恢复**：主动（auto compact，在 API 调用前触发）+ 被动（reactive compact，在 API 返回 413 后触发）。为什么需要两个？因为 token 计数是估算的——客户端的估算可能偏低，导致 auto compact 没触发但 API 认为太长了。Reactive compact 是"最后的安全网"。

7. **Context Collapse 与 Auto Compact 的互斥**：当 Collapse 启用时，Auto Compact 被抑制。这避免了两个系统在 90-95% 区间竞争——Collapse 保留细粒度上下文（每个读操作的摘要），Auto Compact 生成粗粒度摘要（整个对话的摘要）。如果两者同时触发，Auto Compact 通常会赢（因为它更激进），但会丢失 Collapse 保存的细粒度信息。
