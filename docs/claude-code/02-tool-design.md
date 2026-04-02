# 二、工具设计

> 核心源码：`src/Tool.ts`、`src/tools/`（53+ 工具目录）、`src/services/tools/`

## 概述

Claude Code 的工具系统是一个高度类型化的插件架构，通过统一的 `Tool` 接口定义了 30+ 个方法，涵盖执行、权限、渲染、验证和元数据。所有工具通过 `buildTool()` 工厂函数构建，确保安全默认值。

## 教学导读：为什么工具设计是 Agent 系统的灵魂

在 Agent 系统中，模型的能力边界完全由工具决定。模型本身只能生成文本——是工具让它能读文件、写代码、执行命令、搜索网页。

Claude Code 的工具系统面临一个核心矛盾：**灵活性 vs 安全性**。你希望工具足够灵活以支持任意操作，但又需要足够安全以防止模型做出危险行为。这个矛盾的解决方案就是 `Tool` 接口的设计——它不只是"调用一个函数"，而是一个完整的生命周期管理框架。

一个工具从被模型请求到执行完成，经历的完整生命周期：

```
模型输出 tool_use block
    ↓
1. 查找工具（findToolByName，支持别名）
    ↓
2. 输入解析（Zod schema 验证）
    ↓
3. 输入规范化（normalizeToolInput：路径展开、参数标准化）
    ↓
4. backfillObservableInput（为观察者添加派生字段）
    ↓
5. PreToolUse hooks（钩子可以拒绝、修改输入）
    ↓
6. validateInput（工具特定的业务验证）
    ↓
7. checkPermissions（工具特定的权限检查）
    ↓
8. hasPermissionsToUseTool（全局权限决策：规则 → 模式 → 分类器 → 用户）
    ↓
9. tool.call()（实际执行）
    ↓
10. 结果大小检查（超过 maxResultSizeChars → 持久化到磁盘）
    ↓
11. PostToolUse hooks
    ↓
12. 结果 yield 给循环
```

这 12 步中，只有第 9 步是"做事"，其余 11 步都是"确保安全地做事"。这个比例本身就说明了安全在 Agent 系统中的权重。

## Tool 接口核心方法

### 执行层

```typescript
interface Tool<Input, Output, Progress> {
  // 核心执行
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>

  // 输入验证
  validateInput?(input, context): Promise<ValidationResult>

  // 权限检查（在 validateInput 之后调用）
  checkPermissions(input, context): Promise<PermissionResult>

  // 输入 schema（Zod）
  readonly inputSchema: Input
  readonly inputJSONSchema?: ToolInputJSONSchema  // MCP 工具用 JSON Schema

  // 输出 schema
  outputSchema?: z.ZodType<unknown>
}
```

### 并发与安全层

```typescript
interface Tool {
  // 是否可以与其他工具并行执行
  isConcurrencySafe(input): boolean

  // 是否只读（不修改文件系统）
  isReadOnly(input): boolean

  // 是否不可逆（删除、覆盖、发送）
  isDestructive?(input): boolean

  // 用户中断时的行为
  interruptBehavior?(): 'cancel' | 'block'

  // 是否启用
  isEnabled(): boolean
}
```

### 渲染层

```typescript
interface Tool {
  // 工具调用消息渲染
  renderToolUseMessage(input, options): React.ReactNode

  // 工具结果渲染
  renderToolResultMessage?(content, progress, options): React.ReactNode

  // 进度渲染
  renderToolUseProgressMessage?(progress, options): React.ReactNode

  // 拒绝渲染
  renderToolUseRejectedMessage?(input, options): React.ReactNode

  // 错误渲染
  renderToolUseErrorMessage?(result, options): React.ReactNode

  // 分组渲染（并行工具）
  renderGroupedToolUse?(toolUses, options): React.ReactNode | null
}
```

### 元数据层

```typescript
interface Tool {
  name: string
  aliases?: string[]                    // 向后兼容的别名
  searchHint?: string                   // ToolSearch 关键词匹配
  maxResultSizeChars: number            // 结果大小上限（超过则持久化到磁盘）
  readonly shouldDefer?: boolean        // 延迟加载（需要 ToolSearch 发现）
  readonly alwaysLoad?: boolean         // 始终加载（不延迟）
  readonly strict?: boolean             // 严格模式（API 更严格遵守 schema）
  mcpInfo?: { serverName, toolName }    // MCP 工具的原始名称
}
```

## buildTool() 工厂函数——"安全默认"的工程实现

所有工具必须通过 `buildTool()` 构建，它提供安全默认值：

```typescript
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,      // 默认不安全（保守）
  isReadOnly: () => false,              // 默认假设写操作
  isDestructive: () => false,
  checkPermissions: (input) => Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: () => '',      // 默认跳过分类器
  userFacingName: () => '',
}
```

关键设计：**fail-closed**——默认假设工具不安全、会写入、需要权限检查。

### 为什么用工厂函数而不是基类继承？

你可能会想用 `abstract class BaseTool` 来提供默认实现。Claude Code 选择了工厂函数 + 对象展开，原因有三：

1. **TypeScript 的类型推断**：`buildTool()` 使用了高级泛型 `BuiltTool<D>`，能从传入的对象字面量精确推断返回类型。基类继承做不到这一点——你会丢失具体工具的输入/输出类型信息。

2. **组合优于继承**：工具之间没有"is-a"关系。FileReadTool 不是 BashTool 的子类。它们只是共享一组接口。工厂函数让每个工具都是一个独立的对象，没有继承链的耦合。

3. **默认值的可覆盖性**：`{ ...TOOL_DEFAULTS, ...def }` 的展开语义让覆盖变得自然——你只需要在 `def` 中提供你想覆盖的方法。基类需要 `super.method()` 调用，更容易出错。

```typescript
// 使用方式：只提供你关心的方法，其余用默认值
export const FileReadTool = buildTool({
  name: 'Read',
  inputSchema: FileReadInputSchema,
  isConcurrencySafe: () => true,   // 覆盖默认的 false
  isReadOnly: () => true,           // 覆盖默认的 false
  maxResultSizeChars: Infinity,     // 特殊：永不持久化
  // checkPermissions 用默认值（allow）
  // isDestructive 用默认值（false）
  call: async (args, context) => { ... },
  ...
})
```

### BuiltTool<D> 类型体操

`buildTool` 的返回类型 `BuiltTool<D>` 是一个精巧的类型级别展开：

```typescript
type BuiltTool<D> = Omit<D, DefaultableToolKeys> & {
  [K in DefaultableToolKeys]-?: K extends keyof D
    ? undefined extends D[K] ? ToolDefaults[K] : D[K]  // D 提供了 → 用 D 的
    : ToolDefaults[K]                                     // D 没提供 → 用默认
}
```

这确保了：如果你在 `def` 中提供了 `isConcurrencySafe`，返回类型中它的类型就是你提供的那个；如果你没提供，返回类型中它的类型就是默认值的类型。60+ 个工具都通过这个类型检查，零 `as` 断言。

## 工具分类

### 文件操作工具

| 工具 | 并发安全 | 只读 | 说明 |
|------|---------|------|------|
| `FileReadTool` | ✅ | ✅ | 读取文件，支持行范围、图片处理 |
| `FileWriteTool` | ❌ | ❌ | 创建/覆盖文件 |
| `FileEditTool` | ❌ | ❌ | 精确编辑（old_string → new_string） |
| `NotebookEditTool` | ❌ | ❌ | Jupyter Notebook 编辑 |

### 搜索工具

| 工具 | 并发安全 | 说明 |
|------|---------|------|
| `GrepTool` | ✅ | 基于 ripgrep 的内容搜索 |
| `GlobTool` | ✅ | 文件名模式匹配 |
| `ToolSearchTool` | ✅ | 关键词搜索延迟加载的工具 |

### Shell 工具

| 工具 | 并发安全 | 说明 |
|------|---------|------|
| `BashTool` | 动态 | 根据命令语义判断（只读命令并发安全） |
| `PowerShellTool` | 动态 | Windows 等效 |

BashTool 的并发安全判断特别精细：

```typescript
// src/tools/BashTool/commandSemantics.ts
// 解析命令 AST，判断是否只读
// 例如：ls, cat, grep → 并发安全
// 例如：rm, mv, git push → 不安全
```

### Agent 工具

| 工具 | 说明 |
|------|------|
| `AgentTool` | 派生子代理（fork/subagent） |
| `SendMessageTool` | 向已有 Worker 发送消息（Coordinator 模式） |
| `TaskStopTool` | 停止 Worker |
| `TeamCreateTool` | 创建多代理团队 |

### MCP 工具

MCP 工具通过 `MCPTool.ts` 动态生成，每个 MCP 服务器的每个工具都被包装为一个 `Tool` 实例：

```typescript
// src/tools/MCPTool/MCPTool.ts
{
  name: `mcp__${serverName}__${toolName}`,  // 标准前缀
  isMcp: true,
  mcpInfo: { serverName, toolName },
  shouldDefer: !alwaysLoad,                  // 默认延迟加载
}
```

### 特殊工具

| 工具 | 说明 |
|------|------|
| `SyntheticOutputTool` | 结构化输出（JSON schema 强制） |
| `SleepTool` | 主动模式下的休眠 |
| `ScheduleCronTool` | Cron 任务调度 |
| `SkillTool` | 技能执行（`/commit`、`/pr` 等） |
| `TungstenTool` | 内部实时监控 |
| `OverflowTestTool` | 溢出测试 |

## ToolSearch：延迟加载机制——解决"工具爆炸"问题

当用户配置了大量 MCP 服务器时，工具数量可能达到数百个。每个工具的 schema 都要放在系统提示词中，这会消耗大量 token（源码统计：MCP 工具的 schema 平均消耗 ~200 token/个）。

ToolSearch 的解决方案是**延迟加载**——只在初始提示词中发送核心工具，其余工具通过搜索按需加载：

```
初始提示词（~15 个核心工具）
├── FileRead, FileWrite, FileEdit     ← 始终加载
├── Bash, Grep, Glob                  ← 始终加载
├── AgentTool, AskUserQuestion        ← 始终加载
├── ToolSearchTool                    ← 入口工具
└── MCP 工具中标记 alwaysLoad 的      ← 按 MCP 配置

延迟加载的工具（可能数百个）
├── MCP 工具（默认 shouldDefer: true）
├── 不常用的内置工具
└── 通过 ToolSearch 发现后加载
```

模型需要某个工具时：
1. 调用 ToolSearchTool(query="数据库操作")
2. 关键词匹配 searchHint 字段
3. 返回匹配的工具列表
4. 模型在下一轮可以调用这些工具

**API 层面的实现**：延迟工具在 API 请求中带有 `defer_loading: true` 标记。API 不会为这些工具分配 schema 解析资源，直到模型通过 ToolSearch 显式请求。

**一个微妙的 bug 防护**：如果模型直接调用一个延迟加载的工具（没有先 ToolSearch），Zod 验证会失败（因为 API 没有发送完整 schema，模型可能用字符串代替数组）。`buildSchemaNotSentHint()` 检测这种情况，在错误消息中提示模型"先调用 ToolSearch 加载这个工具"。

## 工具结果持久化——防止上下文爆炸的安全阀

当工具输出超过 `maxResultSizeChars` 时：

```typescript
// src/utils/toolResultStorage.ts
// 结果被保存到磁盘文件
// Claude 收到的是摘要 + 文件路径
// FileReadTool 的 maxResultSizeChars = Infinity（永不持久化，避免循环）
```

**为什么 FileReadTool 是 Infinity？** 这是一个防循环设计。如果 FileReadTool 的结果被持久化到文件 X，模型下次想看这个结果就需要 Read 文件 X，Read 的结果又可能被持久化到文件 Y……无限循环。所以 FileReadTool 自己负责限制输出大小（通过 `maxSizeBytes` 和 `maxTokens` 参数），不依赖外部持久化。

**ContentReplacementState**：持久化决策被记录在 `ContentReplacementState` 中，这个状态会被克隆给子代理。为什么？因为子代理共享父进程的消息前缀（为了 prompt cache 命中），如果子代理对同一个 tool_use_id 做出不同的持久化决策，消息前缀的字节就会不同，缓存就会失效。

## backfillObservableInput——"观察者看到的"和"API 看到的"不同

工具可以定义 `backfillObservableInput` 来在观察者（SDK 流、转录、钩子）看到输入之前添加派生字段：

```typescript
// 例如：FileEditTool 展开相对路径为绝对路径
// 原始 API 输入不被修改（保持 prompt cache 一致性）
// 只有克隆的副本被修改
```

**这解决了什么问题？** 模型输出的 `file_path` 可能是相对路径（如 `src/main.ts`），但钩子和 SDK 消费者需要绝对路径来做权限检查。`backfillObservableInput` 在克隆副本上添加 `absolute_path` 字段，让观察者看到完整信息，同时保持原始输入不变。

**为什么不直接修改原始输入？** 因为原始输入会被序列化到 API 请求中。如果修改了它，序列化后的字节就会变化，prompt cache 就会失效。这是一个"**读写分离**"的思想——API 看到的是"写入版本"（不可变），观察者看到的是"读取版本"（可以增强）。

```typescript
// query.ts 中的实现：
let yieldMessage = message
if (message.type === 'assistant') {
  let clonedContent: typeof message.message.content | undefined
  for (const block of message.message.content) {
    if (block.type === 'tool_use' && tool?.backfillObservableInput) {
      const inputCopy = { ...block.input }
      tool.backfillObservableInput(inputCopy)
      // 只有添加了新字段才克隆（覆盖已有字段不算）
      const addedFields = Object.keys(inputCopy).some(k => !(k in originalInput))
      if (addedFields) {
        clonedContent ??= [...message.message.content]
        clonedContent[i] = { ...block, input: inputCopy }
      }
    }
  }
  if (clonedContent) {
    yieldMessage = { ...message, message: { ...message.message, content: clonedContent } }
  }
}
```

## preparePermissionMatcher

工具可以定义自定义的权限匹配器，用于钩子的 `if` 条件：

```typescript
// BashTool: 解析命令前缀，匹配 "Bash(git *)" 规则
// 调用一次，返回闭包，每个钩子模式调用一次
```

## 关键源码文件

| 文件 | 职责 |
|------|------|
| `src/Tool.ts` | Tool 接口定义、buildTool 工厂、类型系统 |
| `src/tools/BashTool/` | 18 个文件，最复杂的工具 |
| `src/tools/AgentTool/` | 14 个文件，子代理系统 |
| `src/tools/FileEditTool/` | 精确编辑工具 |
| `src/tools/MCPTool/` | MCP 工具包装器 |
| `src/tools/ToolSearchTool/` | 延迟加载发现 |
| `src/services/tools/toolOrchestration.ts` | 工具编排（分区 + 并发） |
| `src/services/tools/StreamingToolExecutor.ts` | 流式工具执行器 |
| `src/services/tools/toolExecution.ts` | 单个工具执行 |
