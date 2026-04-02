# 九、Feature Flag 和未来功能

> 核心源码：`src/services/analytics/growthbook.ts`、`src/commands.ts`、`docs/07-feature-gates.md`

## 教学导读：Feature Flag 是"渐进式发布"的工程基础设施

为什么一个 CLI 工具需要 50+ 个 feature flag？因为 Claude Code 不是一个简单的 CLI——它是一个每天被数十万开发者使用的生产系统，同时也是 Anthropic 内部的研发平台。

三层门控解决了三个不同的问题：
- **编译时开关**：解决"外部用户不应该看到内部功能的代码"（安全 + 包大小）
- **USER_TYPE**：解决"同一份代码在内部和外部表现不同"（功能分级）
- **GrowthBook**：解决"不发版本就能开关功能"（灰度发布 + A/B 测试 + 紧急回滚）

这三层的关系不是"三选一"，而是"层层过滤"：

```
源码中的所有功能
    ↓ 编译时 feature() 过滤
外部构建中的功能（~60%）
    ↓ USER_TYPE 过滤
外部用户可见的功能（~40%）
    ↓ GrowthBook 过滤
特定用户实际启用的功能（~35%）
```

## 第一层：编译时开关 feature()

通过 `bun:bundle` 的 `feature()` 函数实现。构建时决定代码包含或排除，未包含的代码被 DCE（Dead Code Elimination）完全移除。

### 核心功能开关（外部版未启用）

| 开关 | 功能 | 复杂度 |
|------|------|--------|
| `BUDDY` | 电子宠物伴侣系统 | 18 种物种、5 级稀有度、闪光系统 |
| `KAIROS` | 持久助手模式 | 后台运行、做梦整合、Cron 调度 |
| `ULTRAPLAN` | 云端深度规划 | 远程 Opus 研究 30 分钟 |
| `COORDINATOR_MODE` | 多 Agent 编排 | Coordinator + Worker 架构 |
| `BRIDGE_MODE` | 远程控制桥接 | 从 claude.ai 操控本地 CLI |
| `VOICE_MODE` | 语音交互 | Nova 3 语音识别 |
| `PROACTIVE` | 主动自主模式 | 没人说话时自己找活干 |
| `FORK_SUBAGENT` | 子代理分叉 | 后台 fork 执行 |
| `DAEMON` | 守护进程模式 | 长运行服务器 |

### 压缩与优化开关

| 开关 | 功能 |
|------|------|
| `CACHED_MICROCOMPACT` | 利用 API 缓存编辑删除旧工具结果 |
| `CONTEXT_COLLAPSE` | 上下文折叠（读/搜索操作摘要化） |
| `REACTIVE_COMPACT` | API 413 后的响应式压缩 |
| `HISTORY_SNIP` | 历史截断 |
| `TOKEN_BUDGET` | Token 预算追踪 |
| `QUICK_SEARCH` | 快速搜索 |

### 安全与合规开关

| 开关 | 功能 |
|------|------|
| `ANTI_DISTILLATION_CC` | 反蒸馏保护 |
| `BASH_CLASSIFIER` | Bash 命令分类器 |
| `TRANSCRIPT_CLASSIFIER` | 转录分类器（自动模式） |
| `NATIVE_CLIENT_ATTESTATION` | 原生客户端证明 |

### 使用方式

```typescript
import { feature } from 'bun:bundle'

// 条件导入（DCE 友好）
const module = feature('KAIROS')
  ? require('./kairos.js')
  : null

// 条件逻辑
if (feature('BUDDY') && isBuddyLive()) {
  // 只在内部构建中存在
}
```

## 第二层：用户类型（USER_TYPE）

`process.env.USER_TYPE` 在构建时被硬编码：

```typescript
// 外部版：process.env.USER_TYPE === 'external'
// 内部版：process.env.USER_TYPE === 'ant'

// 源码中到处可见：
"external" === 'ant'  // 永远为 false（外部版）
```

### ant 专属能力

| 类别 | 能力 |
|------|------|
| 命令 | 24+ 个内部命令（/teleport, /bughunter, /mock-limits...） |
| CLI 参数 | --delegate-permissions, --afk, --tasks, --agent-teams |
| GrowthBook | 调试日志、覆盖、20 分钟刷新（vs 外部 6 小时） |
| 调试 | API 错误详情、推测性执行日志、prompt dump |
| 环境变量 | CLAUDE_INTERNAL_FC_OVERRIDES（JSON 覆盖 GrowthBook） |
| 配置 | /config Gates 标签页（UI 覆盖 GrowthBook） |
| 提示词 | 额外的代码风格指南、注释规范、验证要求 |

### 检查点数量

源码中有 200+ 处 `process.env.USER_TYPE === 'ant'` 检查。

## 第三层：GrowthBook 远程开关

### 基础设施

```typescript
// src/services/analytics/growthbook.ts
// - @growthbook/growthbook SDK
// - 远程评估模式（remoteEval: true）
// - 内部用户 20 分钟刷新，外部用户 6 小时刷新
// - 磁盘缓存跨进程持久化
// - 用户属性：id, deviceID, platform, accountUUID, userType, subscriptionType, rateLimitTier, appVersion
```

### 已知远程开关（tengu_ 前缀）

| 开关 | 控制内容 |
|------|---------|
| `tengu_kairos` | KAIROS 助手模式总开关 |
| `tengu_onyx_plover` | AutoDream 阈值配置 |
| `tengu_cobalt_frost` | 语音识别开关 |
| `tengu_ultraplan_model` | Ultraplan 使用的模型 |
| `tengu_ant_model_override` | 内部用户模型覆盖 |
| `tengu_session_memory` | 会话记忆功能 |
| `tengu_sm_config` | 会话记忆配置 |
| `tengu_max_version_config` | 自动更新 Kill Switch |
| `tengu_ccr_bridge` | Bridge 远程控制总开关 |
| `tengu_scratch` | Coordinator Scratchpad |
| `tengu_otk_slot_v1` | 输出 token 上限优化 |
| `tengu_tool_pear` | 工具严格模式 |
| `tengu_coral_fern` | 搜索过去上下文功能 |
| `tengu_moth_copse` | 跳过 MEMORY.md 索引 |
| `tengu_hive_evidence` | 验证代理 |
| `tengu_cobalt_raccoon` | 仅响应式压缩模式 |

### 覆盖机制

```
优先级（高 → 低）：
1. 环境变量 CLAUDE_INTERNAL_FC_OVERRIDES（JSON 格式，ant-only）
2. /config → Gates 标签页 → growthBookOverrides（ant-only）
3. GrowthBook 远程评估结果
4. 磁盘缓存（~/.claude.json 中的 cachedGrowthBookFeatures）
5. 代码中的默认值
```

### 安全防护

```typescript
// 空 payload 防护
if (!payload?.features || Object.keys(payload.features).length === 0) {
  return false  // 不清空缓存，防止全面 flag 失效
}

// 重初始化追踪
let reinitializingPromise: Promise<unknown> | null = null
// 安全门控检查等待初始化完成，避免返回过期值
```

## 未来功能预览

### BUDDY（电子宠物）

- 18 种物种，5 级稀有度，1% 闪光概率
- 确定性生成（从 userId 哈希）
- 2026 年 4 月 1-7 日预热窗口
- ASCII 精灵动画，气泡对话

### KAIROS（持久助手）

- 关闭终端后继续运行
- 每日日志 + 夜间 Dream 整合
- 主动模式（没人说话时自己找活干）
- Cron 调度器（1 秒 tick）

### ULTRAPLAN（云端规划）

- 将复杂任务发送到云端 Opus
- 独立研究 10-30 分钟
- 浏览器查看/修改/批准方案
- Git Bundle 打包传送

### COORDINATOR（多 Agent 编排）

- 主 Claude 变成纯指挥官
- Worker 并行执行任务
- 四阶段流程：Research → Synthesis → Implementation → Verification

## 关键设计决策与工程权衡

1. **三层过滤**：编译时 → 运行时 → 远程，每层独立控制。这意味着即使 GrowthBook 被攻破（返回 `{KAIROS: true}`），外部构建中 KAIROS 的代码已经被 DCE 移除了，攻击者什么也得不到。

2. **DCE 友好**：`feature()` 只能在 `if` 或三元表达式中使用（不能赋值给变量再判断），因为 Bun 的 tree-shaking 只能识别这两种模式。源码中大量使用 `require()` 而不是 `import` 来做条件导入，就是为了配合这个限制。

3. **磁盘缓存**：GrowthBook 结果持久化到 `~/.claude.json` 的 `cachedGrowthBookFeatures` 字段。这解决了"进程启动时 GrowthBook 还没初始化"的问题——新进程可以立即使用上一个进程缓存的值，不需要等待网络请求。

4. **空 payload 防护**：`if (!payload?.features || Object.keys(payload.features).length === 0) return false`。这一行代码防止了一个灾难性场景：GrowthBook 服务端 bug 返回空 payload → 客户端清空所有 flag → 所有功能被禁用。通过拒绝空 payload，客户端保持使用上一次的有效值。

5. **覆盖机制的优先级设计**：环境变量 > 配置文件 > 远程值 > 磁盘缓存 > 默认值。环境变量最高优先级是为了 eval harness（自动化测试需要确定性的 flag 值）。配置文件次之是为了开发者手动调试。这个优先级链确保了"越临时的覆盖优先级越高"。

6. **tengu_ 前缀的命名约定**：所有 GrowthBook flag 都以 `tengu_` 开头，后面跟两个随机单词（如 `tengu_cobalt_frost`）。随机命名是故意的——防止外部用户通过 flag 名称猜测功能用途。如果叫 `tengu_enable_voice_mode`，竞争对手就知道 Anthropic 在做语音功能了。
