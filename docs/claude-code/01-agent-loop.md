# 一、Agent 循环

> 核心源码：`src/QueryEngine.ts`、`src/query.ts`、`src/services/tools/StreamingToolExecutor.ts`

## 概述

Claude Code 的 Agent 循环是一个基于 AsyncGenerator 的流式状态机。每一轮对话（turn）由 `QueryEngine.submitMessage()` 发起，内部委托给 `query()` 函数执行一个 `while(true)` 无限循环，直到模型不再请求工具调用或触发终止条件。

## 教学导读：为什么 Agent 循环是整个系统的心脏

如果你只能读懂 Claude Code 的一个模块，那就应该是 Agent 循环。它决定了：
- 用户发一条消息后，系统经历哪些步骤才能给出回复
- 模型调用工具后，结果如何被收集并反馈给模型
- 上下文快要爆炸时，系统如何自救
- 出错时，系统如何尝试恢复而不是直接崩溃

理解了这个循环，你就理解了 Claude Code 的"骨架"。其他所有模块（工具、压缩、权限、记忆）都是挂在这个骨架上的"器官"。

## 架构分层

理解 Agent 循环的第一步是看清它的分层。这不是一个扁平的函数调用，而是一个精心设计的四层洋葱模型：

```
┌─────────────────────────────────────────────────────────────┐
│  第 1 层：QueryEngine（会话级）                               │
│  职责：跨 turn 状态管理、系统提示词构建、消息历史持久化          │
│  生命周期：一个对话 = 一个 QueryEngine 实例                    │
├─────────────────────────────────────────────────────────────┤
│  第 2 层：processUserInput（输入处理）                         │
│  职责：斜杠命令解析、附件注入、消息队列消费                     │
│  设计意图：把"用户说了什么"翻译成"系统该做什么"                 │
├─────────────────────────────────────────────────────────────┤
│  第 3 层：query() / queryLoop()（核心循环）                    │
│  职责：API 调用、工具执行、错误恢复、上下文压缩                 │
│  这是真正的 Agent 循环，一个 while(true) 状态机                │
├─────────────────────────────────────────────────────────────┤
│  第 4 层：StreamingToolExecutor（工具执行）                    │
│  职责：并发控制、流式执行、错误级联、进度上报                   │
│  设计意图：让工具执行和 API 流式返回并行，减少延迟              │
└─────────────────────────────────────────────────────────────┘
```

为什么要分四层？因为每一层的**生命周期不同**：
- QueryEngine 活一整个对话（可能几小时）
- processUserInput 活一次用户输入
- query() 活一次 Agent turn（可能包含多次 API 调用）
- StreamingToolExecutor 活一次 API 响应

**架构启示**：当你设计一个复杂系统时，按生命周期分层是最自然的切分方式。每一层只管理自己生命周期内的状态，不越界。

详细调用链：

```
用户输入
    ↓
QueryEngine.submitMessage()     ← 会话级状态管理
    ↓
processUserInput()              ← 斜杠命令解析、附件注入
    ↓
query() / queryLoop()           ← 核心 Agent 循环
    ├── 上下文预处理管线
    │   ├── applyToolResultBudget()    ← 工具结果大小预算
    │   ├── snipCompactIfNeeded()      ← 历史截断（HISTORY_SNIP）
    │   ├── microcompact()             ← 微压缩（缓存编辑）
    │   ├── applyCollapsesIfNeeded()   ← 上下文折叠（CONTEXT_COLLAPSE）
    │   └── autoCompactIfNeeded()      ← 自动压缩
    ├── API 调用 (queryModelWithStreaming)
    ├── 流式工具执行 (StreamingToolExecutor)
    ├── 恢复逻辑
    │   ├── prompt_too_long → reactive compact
    │   ├── max_output_tokens → 升级重试
    │   └── media_size_error → 剥离重试
    └── 停止钩子 (stopHooks)
```

## QueryEngine：会话级状态机

`QueryEngine` 是每个对话的入口，管理跨 turn 的持久状态：

```typescript
class QueryEngine {
  private mutableMessages: Message[]        // 完整对话历史
  private abortController: AbortController  // 中断控制
  private permissionDenials: SDKPermissionDenial[]  // 权限拒绝记录
  private totalUsage: NonNullableUsage      // 累计 token 用量
  private readFileState: FileStateCache     // 文件读取缓存（LRU）
  private discoveredSkillNames: Set<string> // 技能发现追踪
  private loadedNestedMemoryPaths: Set<string> // 已加载的嵌套 CLAUDE.md
}
```

### 为什么需要 QueryEngine 这一层？

你可能会问：为什么不直接调用 `query()` 函数？答案是**状态隔离**。

`query()` 是一个纯粹的循环——它接收消息，调用 API，执行工具，返回结果。但一个完整的对话需要管理很多跨 turn 的状态：文件缓存不能每次都清空（否则同一个文件会被反复读取），权限拒绝记录需要累积（SDK 消费者需要知道哪些工具被拒绝了），token 用量需要跨 turn 累加。

QueryEngine 就是这些跨 turn 状态的"家"。它的设计遵循一个原则：**turn 级状态在每次 submitMessage 开头清空，会话级状态跨 turn 保持**。

```typescript
// 每次 submitMessage 开头：
this.discoveredSkillNames.clear()  // turn 级，清空
// 但 this.readFileState 不清空    // 会话级，保持
// 但 this.totalUsage 不清空       // 会话级，累加
```

### submitMessage 的完整编排

每次 `submitMessage()` 调用经历以下步骤（顺序很重要）：

```
1. 清空 turn 级状态（discoveredSkillNames）
2. 构建系统提示词
   ├── fetchSystemPromptParts() → 三部分并行获取
   │   ├── defaultSystemPrompt（工具描述、行为指南）
   │   ├── userContext（CLAUDE.md、记忆索引）
   │   └── systemContext（git 状态、项目信息）
   ├── 注入 Coordinator 上下文（如果启用多 Agent 模式）
   └── 注入记忆机制提示词（loadMemoryPrompt）
3. 注册结构化输出强制钩子（如果有 JSON schema）
4. 处理用户输入
   ├── 斜杠命令解析（/compact, /clear, /help...）
   ├── 消息队列消费（来自 Bridge 远程控制的消息）
   └── 附件注入（文件状态、技能发现、MCP 指令）
5. 进入 query() 循环
6. 循环结束后，累加 usage，记录转录
```

**工程细节**：步骤 2 中的三部分是**并行获取**的（`Promise.all`），因为它们互不依赖。这是一个典型的"识别独立性 → 并行化"优化。

## query()：核心循环详解

这是整个 Claude Code 最核心的 200 行代码。理解它需要先理解一个关键的架构选择：**为什么用 AsyncGenerator 而不是普通的 async 函数？**

### 架构选择：AsyncGenerator 的三重优势

```typescript
// query() 的签名
export async function* query(params: QueryParams):
  AsyncGenerator<StreamEvent | Message | ToolUseSummaryMessage, Terminal>
```

这个 `function*`（Generator）不是随意选择的，它同时解决了三个问题：

1. **流式输出**：`yield` 让每个消息块在产生时立即推送给上层，用户看到的是逐字出现的效果，而不是等整个响应完成
2. **取消支持**：Generator 天然支持 `.return()`，上层调用 `generator.return()` 就能干净地终止循环，不需要额外的取消机制
3. **背压控制**：上层消费者可以控制消费速度——如果 UI 渲染跟不上，Generator 会自然暂停，不会产生内存堆积

**如果用普通 async 函数会怎样？** 你需要传入一个 `onMessage` 回调，但回调无法表达"暂停生产"的语义，也无法干净地取消。你还需要一个 Promise 来表示"循环结束"，但 Promise 不能携带中间结果。最终你会发现自己在重新发明 AsyncGenerator。

### 状态结构：为什么是一个大对象而不是多个变量？

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  maxOutputTokensOverride: number | undefined
  pendingToolUseSummary: Promise<ToolUseSummaryMessage | null> | undefined
  stopHookActive: boolean | undefined
  turnCount: number
  transition: Continue | undefined  // 上一次迭代为何继续
}
```

源码中有一个精妙的设计：所有可变状态被打包成一个 `State` 对象，在每次 `continue` 时**整体替换**（`state = { ...newState }`），而不是逐字段修改。

**为什么？** 因为循环有 7 个不同的 `continue` 点（reactive compact 重试、max_output_tokens 恢复、stop hook 重试等），每个 `continue` 需要设置不同的状态组合。如果用独立变量，你需要在每个 `continue` 点设置 9 个变量，很容易漏掉一个。用一个对象整体替换，编译器会强制你提供所有字段。

**架构启示**：当一个循环有多个 `continue` 入口时，把循环状态打包成一个不可变对象，在 `continue` 时整体替换，比逐字段修改更安全。

### 每次迭代的完整流程

每次循环迭代就是一次完整的"思考-行动"周期。让我们逐阶段拆解，重点讲**为什么这个顺序不能变**。

**阶段 1：上下文预处理管线**

```
原始消息 → applyToolResultBudget → snipCompact → microcompact → contextCollapse → autoCompact → 最终消息
```

这个管线的顺序是精心设计的，遵循"**从便宜到昂贵、从局部到全局**"的原则：

| 阶段 | 成本 | 范围 | 是否调用 API |
|------|------|------|-------------|
| applyToolResultBudget | 极低 | 单个工具结果 | 否 |
| snipCompact | 低 | 最老的消息组 | 否 |
| microcompact | 低 | 旧工具结果 | 否（或利用缓存编辑） |
| contextCollapse | 中 | 连续读/搜索操作 | 否 |
| autoCompact | 高 | 整个对话历史 | 是（调用 API 生成摘要） |

**为什么 autoCompact 必须在最后？** 因为它要调用 API 生成摘要，是最昂贵的操作。如果前面的轻量级操作已经把 token 数降到阈值以下，autoCompact 就不需要触发了。这是一个经典的"**懒惰求值**"策略——能不做的事就不做。

**为什么 snipCompact 在 microcompact 之前？** 因为 snip 直接丢弃最老的消息（不生成摘要），释放的 token 数可以被 microcompact 的阈值计算感知到。如果反过来，microcompact 可能会对即将被 snip 丢弃的消息做无用功。

每个阶段都是可选的，由 feature flag 控制：
- `applyToolResultBudget`：对超大工具结果进行磁盘持久化，替换为摘要
- `snipCompact`（`HISTORY_SNIP`）：截断最老的消息组，释放 token
- `microcompact`（`CACHED_MICROCOMPACT`）：利用 API 缓存编辑能力删除旧工具结果
- `contextCollapse`（`CONTEXT_COLLAPSE`）：将连续的读/搜索操作折叠为摘要
- `autoCompact`：当 token 超过阈值时触发完整压缩

**阶段 2：API 调用——流式处理的精妙之处**

```typescript
for await (const message of deps.callModel({
  messages: prependUserContext(messagesForQuery, userContext),
  systemPrompt: fullSystemPrompt,
  thinkingConfig,
  tools,
  signal: abortController.signal,
  options: { model, fallbackModel, taskBudget, ... }
})) {
  // 流式处理每个消息块
}
```

这个 `for await` 循环看起来简单，但内部处理了大量边界情况：

关键特性：
- 支持模型降级（`FallbackTriggeredError` → 切换到 fallbackModel）
- 流式工具执行（边接收边执行）
- 可恢复错误的扣留机制（withheld messages）

**扣留机制（Withheld Messages）详解**：这是一个非常精巧的设计。当 API 返回 `prompt_too_long` 或 `max_output_tokens` 错误时，循环**不立即 yield 这个错误给上层**，而是先"扣留"它，尝试恢复。只有恢复失败后，才 yield 错误。

```
API 返回 prompt_too_long
    ↓
withheld = true（不 yield）
    ↓
尝试 context collapse drain
    ├── 成功 → 用压缩后的消息重试（continue）
    └── 失败 → 尝试 reactive compact
                ├── 成功 → 用压缩后的消息重试（continue）
                └── 失败 → yield 原始错误（用户看到报错）
```

**为什么要扣留而不是直接恢复？** 因为 yield 是不可撤回的——一旦 yield 给 SDK 消费者，消费者可能已经把错误展示给用户或终止了会话。扣留给了系统一个"反悔"的机会。

**模型降级的实现**：当主模型（如 Opus）因高负载不可用时，API 层抛出 `FallbackTriggeredError`，循环捕获后：
1. 清空当前 turn 的所有 assistant messages（避免混合两个模型的输出）
2. 丢弃 StreamingToolExecutor 中的待处理结果
3. 切换到 fallbackModel
4. 剥离 thinking signature blocks（不同模型的签名不兼容）
5. yield 一条系统消息告知用户
6. 重新进入 streaming 循环

**阶段 3：流式工具执行——与传统方案的对比**

传统 Agent 框架的工具执行是"等 API 响应完成 → 提取所有 tool_use → 批量执行"。Claude Code 的 StreamingToolExecutor 做了一个激进的优化：**边接收 API 流边执行工具**。

```
传统方案（串行）：
API 流 ████████████████ → 提取工具 → 执行工具 ████████
总延迟 = API 时间 + 工具执行时间

Claude Code（并行）：
API 流 ████████████████
工具执行     ████████████  ← 在 API 还在流式返回时就开始了
总延迟 = max(API 时间, 工具执行时间)  ← 显著更短
```

当 `streamingToolExecution` gate 启用时，工具在 API 流式返回过程中就开始执行：

```
API 流 ──→ 检测到 tool_use block ──→ StreamingToolExecutor.addTool()
                                          ↓
                                    并发安全检查
                                    ├── 安全 → 立即并行执行
                                    └── 不安全 → 排队等待
```

**这带来了一个微妙的问题**：API 可能在流式过程中失败（streaming fallback），此时已经有工具在执行了。StreamingToolExecutor 通过 `discard()` 方法处理这种情况——标记所有待处理工具为废弃，为已执行的工具生成合成错误结果，然后创建一个全新的 executor 重新开始。

**阶段 4：恢复逻辑——"永不放弃"的设计哲学**

循环内置了多层恢复机制。这体现了一个核心设计哲学：**对于一个需要长时间运行的 Agent，任何可恢复的错误都不应该终止会话**。

| 错误类型 | 恢复策略 | 最大重试 | 为什么这样设计 |
|---------|---------|---------|--------------|
| `prompt_too_long` | collapse drain → reactive compact | 各 1 次 | 上下文太大不是用户的错，系统应该自己解决 |
| `max_output_tokens` | 升级到 64k → 多轮继续 | 3 次 | 模型输出被截断，让它继续写就行 |
| `media_size_error` | reactive compact（剥离媒体） | 1 次 | 图片太大，剥离后重试 |
| 模型降级 | 切换 fallbackModel 重试 | 1 次 | 主模型过载，降级总比报错好 |

**max_output_tokens 恢复的精妙之处**：Claude Code 使用了一个"slot reservation"优化——默认只请求 8K output tokens（而不是模型上限的 64K），因为 p99 的实际输出只有 ~5K tokens。这样 API 可以更高效地分配计算资源。但如果模型真的需要更多空间，系统会：
1. 第一次：升级到 64K 重试（同一请求，不注入额外消息）
2. 如果 64K 也不够：注入一条 "continue" 消息，让模型在下一轮继续
3. 最多重试 3 次

```typescript
const MAX_OUTPUT_TOKENS_RECOVERY_LIMIT = 3
// 第一次：CAPPED_DEFAULT_MAX_TOKENS (8K) → ESCALATED_MAX_TOKENS (64K)
// 后续：注入 continue 消息，让模型继续输出
```

**阶段 5：循环终止判断与 Stop Hooks**

```
needsFollowUp = false?（模型没有请求工具调用）
    ├── 是 → 检查恢复逻辑 → 无恢复 → 执行 stopHooks → 返回 Terminal
    └── 否 → 执行工具 → 收集结果 → 注入附件 → continue（下一次迭代）
```

Stop Hooks 是循环结束前的"最后一道关卡"。它们在 `src/query/stopHooks.ts` 中实现，做了很多"收尾"工作：

```
stopHooks 执行的内容：
├── 保存 CacheSafeParams（供后续 fork 复用缓存）
├── 执行用户定义的 Stop hooks（可以阻止循环结束）
├── 触发 Prompt Suggestion（异步，不阻塞）
├── 触发 Extract Memories（异步，不阻塞）
├── 触发 Auto Dream（异步，不阻塞）
├── 清理 Computer Use 锁（如果启用）
└── 如果是 Teammate，执行 TaskCompleted 和 TeammateIdle hooks
```

**关键设计**：Stop hooks 可以返回 `blockingErrors`，这会导致循环**不终止**，而是把错误作为新消息注入，让模型看到并修正。这实现了"用户定义的质量门控"——比如一个 hook 可以运行 `npm test`，如果测试失败就阻止模型说"我完成了"。

## 任务系统

`src/Task.ts` 定义了 7 种任务类型，每种对应一种后台执行模式：

| 类型 | 前缀 | 用途 | 典型场景 |
|------|------|------|---------|
| `local_bash` | `b` | 本地 Shell 命令 | `npm test`、`git push` |
| `local_agent` | `a` | 本地子代理 | AgentTool 派生的 worker |
| `remote_agent` | `r` | 远程代理 | Ultraplan 的云端 Opus |
| `in_process_teammate` | `t` | 进程内队友 | Coordinator 模式的 worker |
| `local_workflow` | `w` | 本地工作流 | 工作流脚本执行 |
| `monitor_mcp` | `m` | MCP 监控 | 长运行 MCP 工具 |
| `dream` | `d` | 记忆整合（做梦） | KAIROS 的夜间整合 |

任务 ID 生成：`前缀 + 8位随机字符`（36^8 ≈ 2.8 万亿组合）

**为什么用前缀？** 因为任务 ID 会出现在日志、文件路径、API 调用中。一个 `b` 开头的 ID 让你一眼就知道这是一个 Bash 任务，不需要查数据库。这是一个"**自描述 ID**"的设计模式。

**为什么 36^8 而不是 UUID？** 因为任务 ID 会出现在文件路径中（`getTaskOutputPath(id)`），UUID 太长了。8 个字符在 2.8 万亿的空间里足够抵抗暴力猜测（源码注释："sufficient to resist brute-force symlink attacks"）。

### 任务状态机

```
pending → running → completed
                  → failed
                  → killed
```

`isTerminalTaskStatus()` 判断任务是否在终态。这个函数被用于：
- 防止向已死的 teammate 注入消息
- 从 AppState 中驱逐已完成的任务
- 孤儿清理路径

## Token 预算追踪

当 `TOKEN_BUDGET` feature flag 启用时，循环维护一个 `budgetTracker`：

```typescript
const budgetTracker = feature('TOKEN_BUDGET') ? createBudgetTracker() : null
```

配合 `taskBudget`（API 级别的 `output_config.task_budget`），在压缩边界处追踪剩余预算：

```
压缩前 → 记录 finalContextTokens → 从 remaining 中扣除 → 传递给下一次 API 调用
```

**为什么需要客户端追踪？** 因为压缩会丢失历史消息。压缩后，API 只能看到摘要，无法知道之前消耗了多少 token。客户端必须在压缩前记录 `finalContextTokens`，然后告诉 API "你之前已经用了这么多，剩余预算是 X"。

```typescript
// 压缩触发时：
if (params.taskBudget) {
  const preCompactContext = finalContextTokensFromLastResponse(messagesForQuery)
  taskBudgetRemaining = Math.max(
    0,
    (taskBudgetRemaining ?? params.taskBudget.total) - preCompactContext,
  )
}
```

## 子代理架构：createSubagentContext 的隔离哲学

Agent 循环不只运行一次——子代理（AgentTool、Session Memory、Auto Dream）都会创建自己的循环。`createSubagentContext()` 是子代理隔离的核心：

```
父进程的 ToolUseContext
    ↓ createSubagentContext()
子代理的 ToolUseContext
    ├── readFileState: 克隆（不是共享！）
    ├── abortController: 新建子控制器（父取消 → 子取消，子取消 ↛ 父取消）
    ├── setAppState: no-op（子代理不能修改父状态）
    ├── setAppStateForTasks: 共享（任务注册必须到达根 store）
    ├── localDenialTracking: 独立（子代理有自己的拒绝计数器）
    ├── contentReplacementState: 克隆（保持缓存一致性）
    └── UI 回调: 全部 undefined（子代理不能控制父 UI）
```

**为什么 readFileState 要克隆而不是共享？** 因为子代理可能读取不同的文件，如果共享 LRU 缓存，子代理的读取会驱逐父进程的缓存条目，导致父进程在下一轮重复读取文件。

**为什么 setAppStateForTasks 要共享？** 因为子代理可能启动后台 Bash 任务，这些任务需要注册到根 AppState 才能被正确管理和清理。如果用 no-op 的 setAppState，任务永远不会被注册，进程退出时变成僵尸进程。

## 关键设计决策与工程权衡

1. **AsyncGenerator 而非回调**：整个循环是一个 `async function*`，通过 `yield` 向上层推送消息，实现了流式输出和取消的自然组合。代价是调试更困难（Generator 的堆栈跟踪不如普通函数清晰），但收益远大于代价。

2. **不可变参数 + 可变状态**：`systemPrompt`、`userContext` 等在循环外固定，`State` 对象在每次 `continue` 时整体替换。这避免了"循环中间修改了系统提示词导致缓存失效"的 bug 类。

3. **恢复优先于失败**：prompt_too_long 不是立即报错，而是尝试 collapse drain → reactive compact → 才报错。这对用户体验至关重要——用户不应该因为对话太长而被迫手动 `/compact`。

4. **工具执行与 API 流并行**：StreamingToolExecutor 让工具在模型还在生成时就开始执行，显著降低延迟。代价是增加了 streaming fallback 时的清理复杂度。

5. **依赖注入（deps 参数）**：`query()` 通过 `deps` 参数接收 `callModel`、`microcompact`、`autocompact` 等函数，而不是直接导入。这让测试可以注入 mock，也让 feature flag 的条件逻辑集中在 `productionDeps()` 中，而不是散落在循环内部。

6. **transition 字段的自文档化**：每次 `continue` 时设置 `transition` 字段（如 `{ reason: 'reactive_compact_retry' }`），让后续迭代知道"我为什么在这里"。这不仅帮助调试，还防止了恢复逻辑的无限循环——比如 collapse drain 重试后如果还是 413，`transition.reason === 'collapse_drain_retry'` 会阻止再次 drain。
