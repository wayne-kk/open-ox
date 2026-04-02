# 五、内容检索策略

> 核心源码：`src/tools/FileReadTool/`、`src/tools/GrepTool/`、`src/tools/GlobTool/`、`src/utils/attachments.ts`、`src/services/skillSearch/`

## 教学导读：为什么内容检索是 Agent 质量的决定性因素

一个 Agent 的输出质量 = 模型能力 × 上下文质量。模型能力是固定的（你用的是 Opus 还是 Sonnet），但上下文质量完全取决于检索策略。

Claude Code 面临的检索挑战：
- 一个项目可能有 10 万个文件，但一次 API 调用只能放 ~200K token
- 模型不知道哪些文件是相关的，需要"探索"
- 探索本身消耗 token 和时间，需要尽量减少
- 有些上下文（CLAUDE.md、记忆）应该自动注入，不需要模型主动请求

解决方案是一个**九层检索管线**，从被动到主动，从精确到模糊：

## 第一层：直接工具调用

### FileReadTool

```typescript
// 支持的输入
{ file_path: string, offset?: number, limit?: number }

// 特性
- 行范围读取（offset + limit）
- 图片处理（通过 image-processor.node 原生模块）
- PDF 解析
- 二进制文件检测
- 文件大小限制（maxSizeBytes，默认约 100KB）
- Token 限制（maxTokens）
- 缓存去重（FileStateCache）
```

FileReadTool 的 `maxResultSizeChars = Infinity`，意味着它的输出永远不会被持久化到磁盘——这避免了 Read→file→Read 的循环。

### GrepTool

```typescript
// 基于 ripgrep
{ pattern: string, path?: string, glob?: string, case_sensitive?: boolean }

// 特性
- 正则表达式搜索
- 文件类型过滤（glob 模式）
- 大小写控制
- 上下文行显示
```

### GlobTool

```typescript
// 文件名模式匹配
{ pattern: string, path?: string }

// 特性
- 递归搜索
- 排除模式（.gitignore 感知）
- 结果数量限制（globLimits.maxResults）
```

## 第二层：FileStateCache（读取去重）

```typescript
// src/utils/fileStateCache.ts
// LRU 缓存，跟踪已读文件的内容哈希
// 同一 turn 内重复读取同一文件时：
//   - 内容未变 → 返回 FILE_UNCHANGED_STUB
//   - 内容已变 → 返回新内容
// 写入操作（FileWrite/FileEdit）使缓存失效
```

这个缓存在 QueryEngine 级别持久化，跨 turn 共享。但它是 LRU 的，在长会话中会驱逐旧条目。

## 第三层：附件系统（Attachments）

`src/utils/attachments.ts` 实现了一个自动附件注入系统：

```typescript
// 在每次 API 调用前，自动注入相关附件
async function getAttachmentMessages(
  messages, toolUseContext, pendingMemoryPrefetch, pendingSkillPrefetch
): Promise<AttachmentMessage[]>
```

附件类型包括：

| 类型 | 说明 | 触发条件 |
|------|------|---------|
| `file_state` | 文件内容快照 | 文件被读取后 |
| `nested_memory` | CLAUDE.md 内容 | 进入新目录时 |
| `agent_listing_delta` | Agent 列表变更 | Agent 定义变化时 |
| `mcp_instructions_delta` | MCP 指令变更 | MCP 服务器连接变化时 |
| `deferred_tools_delta` | 延迟工具变更 | 新工具被发现时 |
| `skill_discovery` | 技能发现 | 每轮自动 |
| `skill_listing` | 技能列表 | 技能变化时 |

## 第四层：记忆预取（Memory Prefetch）

```typescript
// src/utils/attachments.ts
using pendingMemoryPrefetch = startRelevantMemoryPrefetch(messages, toolUseContext)
```

在 query 循环入口处启动异步预取：
1. 分析用户消息的关键词
2. 在记忆目录中搜索相关文件
3. 在工具执行期间并行完成
4. 在附件注入时消费结果

## 第五层：技能发现预取（Skill Discovery Prefetch）

```typescript
// 每次迭代开始时启动
const pendingSkillPrefetch = skillPrefetch?.startSkillDiscoveryPrefetch(
  null, messages, toolUseContext
)
```

技能发现系统（`EXPERIMENTAL_SKILL_SEARCH` feature flag）：
1. 分析当前任务上下文
2. 搜索本地和远程技能库
3. 将相关技能作为 `skill_discovery` 附件注入
4. 模型可以通过 `DiscoverSkillsTool` 主动搜索更多技能

## 第六层：CLAUDE.md 嵌套发现

当模型读取一个新目录中的文件时，系统自动检查该目录是否有 CLAUDE.md：

```typescript
// nestedMemoryAttachmentTriggers: Set<string>
// 跟踪哪些目录的 CLAUDE.md 已经被注入
// loadedNestedMemoryPaths: Set<string>
// 防止重复注入（FileStateCache 是 LRU，可能驱逐）
```

## 第七层：搜索过去的上下文

记忆系统提供了搜索历史上下文的能力：

```typescript
// src/memdir/memdir.ts - buildSearchingPastContextSection
// 1. 搜索记忆目录中的主题文件
//    grep -rn "<search term>" <memoryDir> --include="*.md"
// 2. 搜索会话转录日志（最后手段）
//    grep -rn "<search term>" <projectDir>/ --include="*.jsonl"
```

## 第八层：MagicDocs

```typescript
// src/services/MagicDocs/magicDocs.ts
// 自动从项目中提取文档上下文
// 分析 package.json、README、配置文件等
// 生成项目特定的上下文摘要
```

## 第九层：LSP 集成

```typescript
// src/tools/LSPTool/
// 通过 Language Server Protocol 获取：
// - 符号定义
// - 引用查找
// - 诊断信息
// - 代码补全
```

## 检索策略的优先级

```
1. 直接工具调用（用户/模型显式请求）
    ↓
2. FileStateCache 去重（避免重复读取）
    ↓
3. 自动附件注入（每轮自动）
    ├── 记忆预取（异步，与工具执行并行）
    ├── 技能发现预取（异步）
    └── CLAUDE.md 嵌套发现（触发式）
    ↓
4. 搜索过去的上下文（模型主动搜索记忆/转录）
    ↓
5. LSP 集成（语义级别的代码理解）
```

## 关键设计决策与工程权衡

1. **预取而非阻塞**：记忆和技能发现在工具执行期间异步完成，不阻塞主循环。这利用了一个观察：工具执行（5-30s）远比预取（<1s）慢，所以预取可以"藏在"工具执行的延迟里。`using` 语法确保预取在 Generator 退出时被正确清理。

2. **去重优先**：FileStateCache 防止同一文件被重复读取，节省 token。这不仅是性能优化，也是质量优化——重复的文件内容会稀释上下文中的有用信息。

3. **渐进式发现**：从自动附件到主动搜索，信息获取是渐进的。系统不会一次性把所有可能相关的信息都塞进上下文——那样会超出 token 限制。而是先注入最可能相关的（CLAUDE.md、记忆索引），然后让模型按需搜索更多。

4. **大小限制的层层防护**：每个层级都有 token/字节限制。FileReadTool 有 `maxSizeBytes`，MEMORY.md 有 200 行/25KB 限制，附件有 token 预算，工具结果有 `maxResultSizeChars`。这是一个"**纵深防御**"策略——任何一层的限制被突破，下一层还能兜底。

5. **缓存共享**：子代理通过 `readFileState` 共享文件缓存。这意味着如果父进程已经读过 `src/main.ts`，子代理读同一个文件时会得到 `FILE_UNCHANGED_STUB`，节省了一次磁盘 IO 和大量 token。
