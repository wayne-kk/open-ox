# 六、三层记忆架构

> 核心源码：`src/memdir/memdir.ts`、`src/services/SessionMemory/`、`src/services/autoDream/`、`src/assistant/sessionHistory.ts`

## 教学导读：为什么 LLM 需要"记忆"

LLM 的根本限制是**无状态**——每次 API 调用都是独立的，模型不记得上一次对话。Claude Code 通过三层记忆系统弥补这个缺陷，让模型在跨会话时仍然"认识"用户。

这三层记忆的设计哲学来自人类认知科学：
- **自动记忆** ≈ 长期记忆（你的名字、偏好、项目背景）
- **会话记忆** ≈ 工作记忆（当前任务的上下文摘要）
- **团队记忆** ≈ 集体记忆（团队共享的知识）

每一层解决不同的问题，有不同的读写模式和生命周期。

## 第一层：自动记忆（Auto Memory）

### 存储结构

```
~/.claude/projects/<slug>/memory/
├── MEMORY.md              ← 索引文件（200 行 / 25KB 上限）
├── user_preferences.md    ← 主题文件
├── project_context.md
├── feedback_testing.md
└── logs/                  ← KAIROS 每日日志
    └── 2026/04/
        └── 2026-04-02.md
```

### 四类记忆分类

```typescript
// src/memdir/memoryTypes.ts
type MemoryType = 'user' | 'feedback' | 'project' | 'reference'
```

| 类型 | 说明 | 示例 |
|------|------|------|
| `user` | 用户身份、偏好、角色 | "用户是后端工程师，偏好 TypeScript" |
| `feedback` | 用户对 Claude 行为的反馈 | "不要自动添加注释" |
| `project` | 项目上下文（非代码可推导的） | "截止日期是 4 月 15 日" |
| `reference` | 外部系统指针 | "Dashboard: https://..." |

### 索引文件（MEMORY.md）

```typescript
// 限制
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

// 截断逻辑
function truncateEntrypointContent(raw: string): EntrypointTruncation {
  // 先按行截断（200 行）
  // 再按字节截断（25KB）
  // 在最后一个换行符处截断，不切断行
  // 附加警告信息
}
```

MEMORY.md 始终被加载到系统提示词中（通过 `userContext`），是模型的"记忆入口"。

### 两步保存流程

```
Step 1: 写入主题文件（如 user_role.md）
        包含 frontmatter（name, description, type）

Step 2: 在 MEMORY.md 中添加索引行
        格式：- [Title](file.md) — one-line hook
```

### 目录预创建

```typescript
// ensureMemoryDirExists() 在 prompt 构建时调用
// 保证目录存在，模型可以直接写入
// 提示词中明确说明："This directory already exists"
// 避免模型浪费 turn 去 mkdir
```

## 第二层：会话记忆（Session Memory）

### 触发条件

```typescript
function shouldExtractMemory(messages: Message[]): boolean {
  // 初始化阈值：总 token 数达到 minimumMessageTokensToInit
  // 更新阈值：
  //   1. token 增长达到 minimumTokensBetweenUpdate AND 工具调用数达到阈值
  //   OR
  //   2. token 增长达到阈值 AND 最后一轮没有工具调用（自然对话断点）
}
```

配置通过 GrowthBook `tengu_sm_config` 远程控制：

```typescript
type SessionMemoryConfig = {
  minimumMessageTokensToInit: number      // 初始化 token 阈值
  minimumTokensBetweenUpdate: number      // 更新间隔 token 阈值
  toolCallsBetweenUpdates: number         // 更新间隔工具调用数
}
```

### 执行机制

```typescript
// 注册为 post-sampling hook
registerPostSamplingHook(extractSessionMemory)

// 使用 sequential() 包装，防止并发执行
const extractSessionMemory = sequential(async function(context) {
  // 1. 只在主 REPL 线程运行
  // 2. 检查 GrowthBook gate
  // 3. 检查阈值
  // 4. 创建隔离的子代理上下文
  // 5. 读取当前记忆文件
  // 6. 运行 forkedAgent 提取新记忆
  // 7. 记录 token 用量
})
```

### 隔离执行

```typescript
// 创建隔离上下文，防止污染父进程的缓存
const setupContext = createSubagentContext(toolUseContext)

// 子代理只能编辑记忆文件
const canUseTool = createMemoryFileCanUseTool(memoryPath)
// 只允许 FileEditTool 操作 memoryPath
```

### 与压缩的集成

会话记忆可以作为压缩的替代方案（`sessionMemoryCompact.ts`）：

```
自动压缩触发
    ↓
先尝试 Session Memory Compaction
    ├── 成功 → 使用记忆摘要替代完整压缩
    └── 失败 → 回退到传统 compactConversation
```

## 第三层：团队记忆（Team Memory）

### 启用条件

```typescript
// feature('TEAMMEM') 编译开关
// isTeamMemoryEnabled() = isAutoMemoryEnabled() && GrowthBook('tengu_herring_clock')
```

### 存储结构

```
~/.claude/projects/<slug>/memory/
├── MEMORY.md          ← 个人记忆索引
├── ...                ← 个人主题文件
└── team/              ← 团队记忆目录
    ├── MEMORY.md      ← 团队记忆索引
    └── ...            ← 团队主题文件
```

### 同步机制

```typescript
// src/services/teamMemorySync/
// - watcher.ts: 监视团队记忆目录变化
// - secretScanner.ts: 扫描敏感信息
// - teamMemSecretGuard.ts: 防止秘密泄露到团队记忆
```

## KAIROS 模式下的记忆

KAIROS（持久助手模式）改变了记忆的写入方式：

### 每日日志模式

```typescript
// 不再维护 MEMORY.md 索引
// 改为追加到每日日志文件
const logPathPattern = join(memoryDir, 'logs', 'YYYY', 'MM', 'YYYY-MM-DD.md')

// 每条记忆是一个时间戳子弹点
// 文件是 append-only 的
```

### Dream 整合

每晚的 Dream 进程将日志整合为结构化记忆：

```
每日日志 → Dream 四阶段整合 → MEMORY.md + 主题文件
```

四阶段：
1. **Orient**：列出记忆目录、读取索引
2. **Gather**：从日志和转录中搜集新信号
3. **Consolidate**：合并到主题文件，转换相对日期
4. **Prune**：更新索引，保持在限制内

### Dream 触发条件

```typescript
// 三层门控（由廉到贵）
1. 时间门控：距上次整合超过 24 小时
2. 会话门控：至少 5 个新会话
3. 锁门控：没有其他进程正在整合
```

## 会话历史 API

```typescript
// src/assistant/sessionHistory.ts
// 通过 OAuth API 加载远程会话历史
// 端点：v1/sessions/{sessionId}/events
// 支持分页拉取
// 用于 KAIROS 模式下的跨会话上下文
```

## 记忆的生命周期

```
用户交互
    ↓
自动记忆：用户显式要求 "记住这个" → 立即保存
    ↓
会话记忆：后台 post-sampling hook → 定期提取
    ↓
团队记忆：同步到团队目录 → 秘密扫描 → 共享
    ↓
KAIROS 日志：追加到每日日志 → Dream 整合 → 结构化记忆
```

## 关键设计决策与工程权衡

1. **文件系统而非数据库**：所有记忆都是 Markdown 文件，用户可以直接编辑。这是一个"**可审计性优先**"的设计——用户可以 `cat ~/.claude/projects/*/memory/MEMORY.md` 看到 Claude 记住了什么，可以手动删除不想被记住的内容。数据库做不到这种透明度。

2. **索引 + 主题文件**：MEMORY.md 是轻量索引（始终加载到上下文），详细内容在主题文件中（按需读取）。这是一个经典的"**目录 + 正文**"模式——索引消耗固定的 token（最多 200 行），但可以指向任意多的详细内容。

3. **隔离执行**：记忆提取在隔离的子代理中运行，不污染主对话。这意味着记忆提取的工具调用（FileEdit）不会出现在用户的对话历史中，也不会消耗用户的 token 预算。`createMemoryFileCanUseTool` 确保子代理只能编辑记忆文件，不能操作用户的代码。

4. **秘密防护**：团队记忆有专门的秘密扫描器（`secretScanner.ts`），防止 API key、密码等敏感信息被写入共享记忆。这是一个"**安全边界**"——个人记忆可以包含任何内容，但团队记忆必须经过过滤。

5. **Dream 的三层门控**：时间 → 会话数 → 锁。这个顺序是"由廉到贵"的——检查时间戳几乎零成本，检查会话数需要读文件，获取锁需要文件系统操作。如果时间门控就过滤掉了 90% 的检查，后面的昂贵操作就很少执行。

6. **确定性宠物生成**：Buddy 宠物的属性从 userId 确定性计算（FNV-1a 哈希 → Mulberry32 PRNG），不可篡改。"骨架"数据（species, rarity）每次重新计算，不持久化。只有"灵魂"数据（name, personality）存入配置。这防止了用户通过编辑配置文件来"作弊"获得传说级宠物。
