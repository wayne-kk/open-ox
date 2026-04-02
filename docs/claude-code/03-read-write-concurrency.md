# 三、读写分离的工具并发

> 核心源码：`src/services/tools/toolOrchestration.ts`、`src/services/tools/StreamingToolExecutor.ts`

## 概述

Claude Code 实现了一套精细的工具并发控制系统，核心原则是：**只读工具可以并行，写入工具必须串行**。这套系统有两个实现路径——传统的 `runTools`（后处理批量执行）和新的 `StreamingToolExecutor`（流式边接收边执行）。

## 教学导读：为什么并发控制是 Agent 系统的性能关键

一个典型的 Agent turn 可能包含 5-10 个工具调用。如果全部串行执行，延迟是所有工具执行时间之和。但如果能并行执行只读工具，延迟就是最慢那个工具的时间。

```
串行：Read(1s) → Grep(0.5s) → Read(1s) → Write(0.3s) → Read(1s) = 3.8s
并行：[Read(1s) + Grep(0.5s) + Read(1s)] → Write(0.3s) → Read(1s) = 2.3s
                                                                      ↑ 快了 40%
```

但并行引入了一个根本性问题：**如果两个工具同时写同一个文件怎么办？** Claude Code 的答案是：不允许。写入工具永远串行。这是一个"**宁可慢一点，也不要出错**"的设计选择。

## 并发安全判定

每个工具通过 `isConcurrencySafe(input)` 方法声明自己是否可以并行执行：

```typescript
// 静态安全（始终并发安全）
FileReadTool:    isConcurrencySafe = () => true
GrepTool:        isConcurrencySafe = () => true
GlobTool:        isConcurrencySafe = () => true
WebSearchTool:   isConcurrencySafe = () => true
WebFetchTool:    isConcurrencySafe = () => true

// 静态不安全（始终串行）
FileWriteTool:   isConcurrencySafe = () => false
FileEditTool:    isConcurrencySafe = () => false
AgentTool:       isConcurrencySafe = () => false

// 动态判定（根据输入决定）
BashTool:        isConcurrencySafe = (input) => isReadOnlyCommand(input.command)
```

### BashTool 的命令语义分析

BashTool 的并发安全判定是最复杂的，它解析命令的 AST 来判断：

```typescript
// src/tools/BashTool/commandSemantics.ts
// 只读命令（并发安全）：ls, cat, grep, find, wc, head, tail, echo, pwd, ...
// 写入命令（不安全）：rm, mv, cp, mkdir, git push, npm install, ...
// 管道：所有子命令都只读才安全
// 重定向：有输出重定向（>、>>）则不安全
```

## 传统路径：partitionToolCalls + runTools

`toolOrchestration.ts` 中的 `runTools` 函数将工具调用分区为交替的批次：

```typescript
function partitionToolCalls(toolUseMessages, toolUseContext): Batch[] {
  // 输入：[Read, Grep, Write, Read, Read, Edit]
  // 输出：
  //   Batch 1: { isConcurrencySafe: true,  blocks: [Read, Grep] }
  //   Batch 2: { isConcurrencySafe: false, blocks: [Write] }
  //   Batch 3: { isConcurrencySafe: true,  blocks: [Read, Read] }
  //   Batch 4: { isConcurrencySafe: false, blocks: [Edit] }
}
```

执行策略：
- **并发安全批次**：通过 `runToolsConcurrently` 并行执行，最大并发数由 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 控制（默认 10）
- **非安全批次**：通过 `runToolsSerially` 逐个执行

```
时间线：
├── [Read, Grep]  ──→ 并行执行 ──→ 收集结果
├── [Write]       ──→ 串行执行 ──→ 收集结果
├── [Read, Read]  ──→ 并行执行 ──→ 收集结果
└── [Edit]        ──→ 串行执行 ──→ 收集结果
```

### 并发执行的实现

```typescript
async function* runToolsConcurrently(toolUseMessages, ...): AsyncGenerator {
  yield* all(
    toolUseMessages.map(async function* (toolUse) {
      yield* runToolUse(toolUse, ...)
    }),
    getMaxToolUseConcurrency(),  // 最大并发数
  )
}
```

`all()` 是一个自定义的并发 AsyncGenerator 合并器（`src/utils/generators.ts`），它：
1. 同时启动最多 N 个 generator
2. 按完成顺序 yield 结果
3. 保持最大并发数

### 上下文修改器（Context Modifiers）

非并发安全的工具可以返回 `contextModifier`，修改后续工具的执行上下文：

```typescript
// 只有非并发安全的工具的 contextModifier 会被应用
// 并发安全的工具的 contextModifier 被排队，在批次结束后按顺序应用
if (!tool.isConcurrencySafe && contextModifiers.length > 0) {
  for (const modifier of contextModifiers) {
    this.toolUseContext = modifier(this.toolUseContext)
  }
}
```

## 流式路径：StreamingToolExecutor

`StreamingToolExecutor` 是更新的实现，在 API 流式返回过程中就开始执行工具：

### 状态机

每个工具经历四个状态：

```
queued → executing → completed → yielded
```

### 并发控制逻辑

```typescript
private canExecuteTool(isConcurrencySafe: boolean): boolean {
  const executingTools = this.tools.filter(t => t.status === 'executing')
  return (
    executingTools.length === 0 ||
    (isConcurrencySafe && executingTools.every(t => t.isConcurrencySafe))
  )
}
```

规则：
1. 没有正在执行的工具 → 任何工具都可以开始
2. 所有正在执行的工具都是并发安全的，且新工具也是并发安全的 → 可以并行
3. 否则 → 等待

### 队列处理

```typescript
private async processQueue(): Promise<void> {
  for (const tool of this.tools) {
    if (tool.status !== 'queued') continue
    if (this.canExecuteTool(tool.isConcurrencySafe)) {
      await this.executeTool(tool)
    } else {
      // 非并发安全的工具阻塞后续所有工具
      if (!tool.isConcurrencySafe) break
    }
  }
}
```

### 错误级联——为什么只有 Bash 会"连坐"

当一个 Bash 工具出错时，会取消所有兄弟工具：

```typescript
if (isErrorResult && tool.block.name === BASH_TOOL_NAME) {
  this.hasErrored = true
  this.erroredToolDescription = this.getToolDescription(tool)
  this.siblingAbortController.abort('sibling_error')
}
```

关键设计：**只有 Bash 错误会级联**。原因是 Bash 命令经常有隐式依赖链（mkdir 失败 → 后续命令无意义），而 Read/WebFetch 等工具是独立的。

**深入理解这个设计**：模型经常会在一个 turn 中发出多个 Bash 命令，比如：
```
Bash("mkdir -p src/components")
Bash("cat > src/components/Button.tsx << 'EOF' ...")
Bash("npm test")
```

如果 `mkdir` 失败了，后面的 `cat` 和 `npm test` 肯定也会失败。让它们继续执行不仅浪费时间，还会产生误导性的错误信息（"file not found" 而不是 "directory creation failed"）。

但如果是 `Read("src/a.ts")` 和 `Read("src/b.ts")` 并行执行，一个失败不应该影响另一个——它们完全独立。

**siblingAbortController 的层级设计**：

```
toolUseContext.abortController（用户中断）
    └── siblingAbortController（Bash 错误级联）
            ├── toolAbortController for tool 1
            ├── toolAbortController for tool 2
            └── toolAbortController for tool 3
```

- 用户中断 → 所有工具都停止
- Bash 错误 → 兄弟工具停止，但不影响用户中断控制器（循环继续）
- 单个工具的权限拒绝 → 只停止该工具，但需要冒泡到用户中断控制器（让循环结束 turn）

### 中断行为

工具可以声明 `interruptBehavior`：
- `'cancel'`：用户提交新消息时停止工具，丢弃结果
- `'block'`：继续运行，新消息等待

### 进度消息

进度消息（`progress` 类型）被立即 yield，不等待工具完成：

```typescript
if (update.message.type === 'progress') {
  tool.pendingProgress.push(update.message)
  // 唤醒 getRemainingResults 的等待
  this.progressAvailableResolve?.()
}
```

### 结果顺序保证

结果按工具接收顺序 yield（不是完成顺序）：

```typescript
*getCompletedResults(): Generator<MessageUpdate> {
  for (const tool of this.tools) {
    // 先 yield 进度消息
    while (tool.pendingProgress.length > 0) { yield ... }

    if (tool.status === 'yielded') continue
    if (tool.status === 'completed') {
      tool.status = 'yielded'
      for (const message of tool.results) { yield ... }
    } else if (!tool.isConcurrencySafe) {
      break  // 非安全工具阻塞后续结果
    }
  }
}
```

## FileStateCache：读取去重——一个看似简单但充满陷阱的缓存

`src/utils/fileStateCache.ts` 实现了一个 LRU 缓存，防止同一 turn 内重复读取同一文件：

```typescript
// FileReadTool 读取文件后缓存内容哈希
// 下次读取同一文件时，如果内容未变，返回 FILE_UNCHANGED_STUB
// 写入工具（FileWrite/FileEdit）会使缓存失效
```

这个缓存在 QueryEngine 级别持久化，跨 turn 共享。但它是 LRU 的，在长会话中会驱逐旧条目。

**陷阱 1：LRU 驱逐导致重复注入**。CLAUDE.md 的嵌套发现依赖 FileStateCache 的 `.has()` 检查来避免重复注入。但 LRU 驱逐后，`.has()` 返回 false，同一个 CLAUDE.md 会被再次注入。解决方案：额外维护一个 `loadedNestedMemoryPaths: Set<string>`，不受 LRU 影响。

**陷阱 2：子代理的缓存隔离**。子代理通过 `cloneFileStateCache()` 获得父缓存的克隆。为什么不共享？因为子代理可能读取大量文件，驱逐父缓存的条目。为什么不用空缓存？因为子代理需要知道父进程已经读过哪些文件（用于 `FILE_UNCHANGED_STUB` 去重）。克隆是两者的折中。

## 关键设计决策与工程权衡

1. **保守默认**：`isConcurrencySafe` 默认 `false`，新工具必须显式声明并发安全。这意味着忘记声明只会导致性能下降（串行执行），不会导致正确性问题（并发写入）。
2. **Bash 特殊处理**：Bash 是唯一动态判定并发安全性的工具，也是唯一触发错误级联的工具。这反映了 Bash 在 Agent 系统中的特殊地位——它是最强大也最危险的工具。
3. **结果顺序 vs 执行顺序**：执行可以乱序，但结果始终按接收顺序 yield。这对 SDK 消费者很重要——他们期望 tool_result 的顺序与 tool_use 一致。
4. **流式执行**：StreamingToolExecutor 让工具在模型还在生成时就开始执行，减少了端到端延迟
5. **最大并发数可配置**：`CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 环境变量控制，默认 10
