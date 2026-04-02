# 十、反蒸馏和卧底模式

> 核心源码：`src/utils/undercover.ts`、`src/utils/commitAttribution.ts`、`src/constants/prompts.ts`

## 教学导读：当 AI 公司的员工用自家 AI 写开源代码

这是一个独特的工程问题：Anthropic 的工程师用 Claude Code（内部版，功能更多）给开源项目贡献代码。如果不小心，提交消息里可能出现 "Fixed with Claude Capybara v8"——这就泄露了未发布的模型代号。

卧底模式的设计目标是：**让 AI 生成的提交看起来完全像人类写的**。这不是为了欺骗，而是为了保护商业机密。

反蒸馏则解决另一个问题：竞争对手可能系统性地使用 Claude Code 来提取 Claude 的能力（通过大量工具调用观察模型的行为模式），然后用这些数据训练自己的模型。

## 反蒸馏保护（ANTI_DISTILLATION_CC）

### 编译开关

```typescript
feature('ANTI_DISTILLATION_CC')
```

这是一个编译时开关，外部版本中未启用。具体实现细节在源码中被混淆，但从 feature flag 名称和上下文可以推断其目的：

- 防止通过 Claude Code 的输出系统性地提取模型能力
- 可能包含输出水印（watermarking）机制
- 可能包含检测异常使用模式的遥测

### 相关遥测

```typescript
// 多个遥测事件与反蒸馏相关
// MEMORY_SHAPE_TELEMETRY: 记忆形状遥测
// COWORKER_TYPE_TELEMETRY: 协作者类型遥测
// PROMPT_CACHE_BREAK_DETECTION: 缓存中断检测
```

## 卧底模式（Undercover Mode）

### 激活逻辑

```typescript
// src/utils/undercover.ts
export function isUndercover(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    // 强制开启
    if (isEnvTruthy(process.env.CLAUDE_CODE_UNDERCOVER)) return true
    // 自动模式：除非确认在内部仓库中，否则默认开启
    return getRepoClassCached() !== 'internal'
  }
  return false  // 外部版本永远返回 false
}
```

关键设计：**安全默认为 ON**。只有当系统确认当前仓库是 Anthropic 内部仓库时才关闭。没有强制关闭的方式。

### 仓库分类

```typescript
// src/utils/commitAttribution.ts
// getRepoClassCached() 返回：
// - 'internal': 内部仓库（匹配 INTERNAL_MODEL_REPOS 白名单）
// - 'external': 外部仓库
// - 'none': 非 git 仓库
// - null: 检查尚未运行
```

### 卧底指令

当卧底模式激活时，以下指令被注入到系统提示词中：

```
## UNDERCOVER MODE — CRITICAL

You are operating UNDERCOVER in a PUBLIC/OPEN-SOURCE repository.
Your commit messages, PR titles, and PR bodies MUST NOT contain
ANY Anthropic-internal information. Do not blow your cover.

NEVER include in commit messages or PR descriptions:
- Internal model codenames (animal names like Capybara, Tengu, etc.)
- Unreleased model version numbers (e.g., opus-4-7, sonnet-4-8)
- Internal repo or project names (e.g., claude-cli-internal, anthropics/…)
- Internal tooling, Slack channels, or short links (e.g., go/cc, #claude-code-…)
- The phrase "Claude Code" or any mention that you are an AI
- Any hint of what model or version you are
- Co-Authored-By lines or any other attribution

Write commit messages as a human developer would — describe only
what the code change does.
```

### 好的 vs 坏的提交消息

```
GOOD:
- "Fix race condition in file watcher initialization"
- "Add support for custom key bindings"
- "Refactor parser for better error messages"

BAD (never write these):
- "Fix bug found while testing with Claude Capybara"
- "1-shotted by claude-opus-4-6"
- "Generated with Claude Code"
- "Co-Authored-By: Claude Opus 4.6 <…>"
```

### 首次提示

```typescript
export function shouldShowUndercoverAutoNotice(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isEnvTruthy(process.env.CLAUDE_CODE_UNDERCOVER)) return false  // 强制模式不提示
    if (!isUndercover()) return false
    if (getGlobalConfig().hasSeenUndercoverAutoNotice) return false
    return true
  }
  return false
}
```

首次自动激活时显示一次性说明对话框，之后不再提示。

### 与提示词系统的集成

```typescript
// src/constants/prompts.ts
function getAntModelOverrideSection(): string | null {
  if (process.env.USER_TYPE !== 'ant') return null
  if (isUndercover()) return null  // 卧底模式下不注入模型覆盖信息
  return getAntModelOverrideConfig()?.defaultSystemPromptSuffix || null
}
```

卧底模式下，模型不被告知自己是什么模型。

## 排除字符串机制

源码中多处提到 `excluded-strings.txt`：

```typescript
// src/buddy/types.ts 中的注释：
// 物种名全部用 String.fromCharCode 十六进制编码
// 原因：某个物种名与内部模型代号冲突
// 会被 excluded-strings.txt 构建检查拦截
// 所以全部改用编码绕过

// 例如：c(0x64,0x75,0x63,0x6b) = "duck"
```

这意味着构建系统有一个字符串黑名单，防止内部代号出现在外部构建中。

## 提交归属（Commit Attribution）

```typescript
// src/utils/commitAttribution.ts
// COMMIT_ATTRIBUTION feature flag
// 控制是否在 git 提交中添加 Claude 归属信息
// 卧底模式下完全禁用
```

### 归属头部

```typescript
// CLAUDE_CODE_ATTRIBUTION_HEADER 环境变量
// 允许自定义归属头部
// 卧底模式下被忽略
```

## 多层保护总结

```
外部用户看到的
═══════════════════════════════
  无反蒸馏、无卧底模式
  （代码被 DCE 移除）

内部用户 + 内部仓库
═══════════════════════════════
  反蒸馏保护启用
  卧底模式关闭
  完整归属信息

内部用户 + 外部仓库
═══════════════════════════════
  反蒸馏保护启用
  卧底模式自动开启
  无归属信息
  模型身份隐藏
  提交消息伪装为人类

内部用户 + 强制卧底
═══════════════════════════════
  CLAUDE_CODE_UNDERCOVER=1
  即使在内部仓库也启用卧底
```

## 构建时保护

```
源码
    ↓
excluded-strings.txt 检查    ← 防止内部代号泄露
    ↓
feature() DCE               ← 移除未启用的功能代码
    ↓
USER_TYPE 硬编码             ← 'external' 使所有 ant 检查失效
    ↓
外部构建产物
```

## 关键设计决策与工程权衡

1. **安全默认 ON**：卧底模式默认开启，只有确认内部仓库才关闭。这是"**假阳性优于假阴性**"的安全原则——宁可在内部仓库中多余地隐藏身份（无害），也不要在外部仓库中泄露信息（有害）。

2. **无强制关闭**：没有 `CLAUDE_CODE_UNDERCOVER=0` 的 force-OFF 机制。这是故意的——如果有 force-OFF，某个工程师可能会"为了方便"关掉它，然后忘记打开，导致泄露。没有 OFF 选项就没有这个风险。

3. **编码绕过**：内部代号用 `String.fromCharCode(0x64,0x75,0x63,0x6b)` 编码。这不是加密（任何人都能解码），而是绕过构建系统的字符串黑名单检查。`excluded-strings.txt` 会扫描源码中的明文字符串，但不会解析 `fromCharCode` 调用。这是一个"**工具链限制的务实绕过**"。

4. **三层保护的互补性**：编译时 DCE 移除代码 → 运行时检查阻止执行 → 提示词注入改变行为。即使某一层失效（比如 DCE 没有完全移除），其他层仍然有效。这是纵深防御在信息保护领域的应用。

5. **一次性提示**：首次自动激活时显示说明对话框，之后静默运行。这平衡了"用户知情权"和"不打扰"——用户需要知道卧底模式存在（否则可能困惑为什么提交消息没有 AI 归属），但不需要每次都被提醒。

6. **模型身份隐藏**：卧底模式下，`getAntModelOverrideSection()` 返回 null，模型不被告知自己是什么模型。这防止了模型在输出中无意泄露自己的身份（"As Claude Opus 4.6, I..."）。

7. **仓库分类的保守策略**：`getRepoClassCached()` 返回 `'external'`、`'none'`、`null` 时都视为"不安全"，只有明确匹配 `INTERNAL_MODEL_REPOS` 白名单时才视为"安全"。白名单比黑名单更安全——你只需要列出已知的内部仓库，而不需要列出所有外部仓库。
