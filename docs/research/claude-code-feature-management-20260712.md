# 调研：Claude Code 能力门控 / Feature Management（2026-07-12）

**状态**：完成（官方文档能确认「存在 GrowthBook 远程 flag、可用 env 关闭、产品层按计划/供应商裁剪」；**完整三层门控架构**主要来自本仓库 `docs/claude-code/` 源码笔记，非 Anthropic 已发布架构文档）  
**日期**：2026-07-12  
**问题**：Claude Code 如何管理「产品能力 / 功能是否被支持与启用」？请文档化完整门控架构（编译时、用户类型、远程 flag、本地覆盖、kill switch、命令/工具如何挂在门后等）。

**范围说明**：

1. **产品层可用性**（计划 / 供应商 / managed settings）——Anthropic **已公开发布**。
2. **客户端门控实现**（`feature()` / `USER_TYPE` / GrowthBook `tengu_*` / 覆盖链）——主要来自本仓库逆向教学笔记；笔记自陈路径如 `src/services/analytics/growthbook.ts`、`src/commands.ts`、内部 `docs/07-feature-gates.md`。
3. **GrowthBook SDK 机制**（`remoteEval`、缓存）——仅引用 GrowthBook 官方文档，**不**当作 Claude Code 实现细节的证明。

**不在范围**：为 Open-OX 设计具体 Feature Package API；第三方 wiki / 非官方 leak mirror 的二次转述（仅作「存在公开讨论」线索，不作为架构断言）。

**来源分层（全文适用）**：

| 标签 | 含义 |
|------|------|
| **A. 官方文档** | code.claude.com / docs.anthropic.com / Anthropic GitHub issues 中 Anthropic 团队回复 |
| **B. 仓库源码笔记（非 Anthropic 已发布文档）** | `docs/claude-code/*.md`，自陈基于 Claude Code 内部源码 |
| **C. 推断 / 未核验** | 笔记推断、第三方讨论、或无法在本轮对公开源码树二次核验的细节 |

**Open-OX 对照动机**：产品想法中的「Feature package / capability gate」——本笔记只提炼架构教训，不展开 Open-OX 方案设计。

**公开源码可达性**：官方 [`anthropics/claude-code`](https://github.com/anthropics/claude-code) 仓库是产品/发行面（非完整 CLI TypeScript 源）。2026-03 前后有 npm sourcemap 泄露与社区 mirror 的公开报道（TechCrunch 等），但 **本轮研究未对任何 leak mirror 做逐文件核验**。下列 B 层主张以本仓库教学笔记为准，并在「Open questions」中标出仍需源码访问才能钉死的点。

---

## 1. 结论摘要

Claude Code 的「能力是否可用」不是单一开关，而是 **多层过滤器叠加**。公开文档只完整说明了其中两层半（产品 entitlement + 用户/管理员 env/settings + GrowthBook 可关闭）；编译时 DCE 与 `USER_TYPE` 分层主要出现在源码笔记中。

| 层 | 解决什么问题 | 证据层级 | 典型机制 |
|----|--------------|----------|----------|
| **产品 entitlement** | 计划 / 登录方式 / 云供应商决定「能不能碰这能力」 | **A** | Feature availability 表；Remote Control「Admin-enabled」等 |
| **Managed / env 粗粒度闸门** | 组织策略与本地禁用（含危险模式） | **A** | `disableBypassPermissionsMode`、`DISABLE_*`、`DISABLE_GROWTHBOOK` |
| **编译时 `feature()` + DCE** | 外部包根本不含内部功能代码（安全 + 体积） | **B** | `bun:bundle` 的 `feature('KAIROS')` 等 |
| **`USER_TYPE`（ant vs external）** | 同一套源码，内外构建行为分级 | **B** | 构建时硬编码 `process.env.USER_TYPE` |
| **GrowthBook 远程 `tengu_*`** | 不发版即可灰度 / A-B / 紧急回滚 | **A**（存在与可关）+ **B**（SDK 细节、命名、属性） | `@growthbook/growthbook`、`remoteEval`、磁盘缓存 |
| **本地覆盖（多为 ant）** | 测试确定性、调试 | **B** | `CLAUDE_INTERNAL_FC_OVERRIDES`、`/config` Gates |
| **Kill switch** | 紧急关掉危险/滥用面 | **A**（managed `disableBypass…`）+ **B**（GrowthBook kill switch 文件） | 权限 bypass、自动更新 max version 等 |

**一句话（B 层架构图 + A 层外环）**：源码笔记把内部实现概括为「编译时去掉代码 → `USER_TYPE` 过滤可见性 → GrowthBook 决定本用户是否真正启用」；官方文档则从外环确认：计划/供应商 entitlement、大量 `DISABLE_*`、以及 **GrowthBook 远程 feature-flag 拉取可被显式关闭且会落到代码默认值**。

源码笔记中的过滤漏斗（**B**，`docs/claude-code/09-feature-flags.md`）：

```
源码中的所有功能
    ↓ 编译时 feature() 过滤
外部构建中的功能（笔记估计 ~60%）
    ↓ USER_TYPE 过滤
外部用户可见的功能（笔记估计 ~40%）
    ↓ GrowthBook 过滤
特定用户实际启用的功能（笔记估计 ~35%）
```

百分比为笔记教学近似值，**非官方度量（C）**。

---

## 2. A 层：Anthropic 公开文档实际说了什么

### 2.1 产品 / 计划 / 供应商可用性（entitlement，不是客户端 flag 架构）

官方 [Feature availability](https://code.claude.com/docs/en/feature-availability) 按 **认证方式与订阅计划** 列出能力矩阵，例如：

- 部分能力仅 Claude subscription（如 Remote Control、Routines、Ultraplan、Voice dictation）。
- 同一 CLI 能力在 Bedrock / Vertex / Foundry 上可能不可用或部分可用（如 Web search、Fast mode、Auto mode）。
- Team/Enterprise 上 Remote Control / Channels 可为 **Admin-enabled**（组织管理员打开才可用）。

这是 **商业与部署面的门控**，文档不解释客户端如何用 GrowthBook 实现，也不提 `tengu_*` / `feature()` / `USER_TYPE`。

### 2.2 官方明确承认 GrowthBook feature-flag 拉取

[Environment variables](https://code.claude.com/docs/en/env-vars)：

| 变量 | 官方表述 |
|------|----------|
| `DISABLE_GROWTHBOOK` | Set to `1` to **disable GrowthBook feature-flag fetching** and **use code defaults for every flag**. Telemetry event logging stays on unless `DISABLE_TELEMETRY` is also set. |
| `DISABLE_TELEMETRY` | Opt out of telemetry. **Also disables feature-flag fetching with the same effect as `DISABLE_GROWTHBOOK`**, so **some flagged features may be unavailable**. |
| `DO_NOT_TRACK` | Equivalent to `DISABLE_TELEMETRY`. |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Equivalent of setting `DISABLE_AUTOUPDATER`, `DISABLE_FEEDBACK_COMMAND`, `DISABLE_ERROR_REPORTING`, and `DISABLE_TELEMETRY`（因而间接影响 flag 拉取）。 |

含义（**A**）：

1. Claude Code **确实**用 GrowthBook 做远程 feature-flag。
2. 关闭拉取后走 **代码内默认值**。
3. 遥测 opt-out 与 flag 拉取 **耦合**（文档写明；用户 issue 亦讨论过副作用）。

相关产品依赖（**A**）：[Automate work with routines](https://code.claude.com/docs/en/web-scheduled-tasks) 写明：若设置了 `DISABLE_TELEMETRY` / `DO_NOT_TRACK` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK`，会禁用 feature-flag fetching，而 **`/schedule` 依赖该拉取**。

Changelog 侧面佐证（**A**）：官方 changelog 出现过「`--tools` allowing **feature-gated tools** to slip through before flags loaded on a cold first launch」以及「cold GrowthBook」相关修复——说明工具注册与 flag 冷启动时序是真实产品问题。

### 2.3 官方「粗粒度」能力开关（env / settings / managed）

大量能力用 **显式 env / settings** 关闭，与 GrowthBook 正交。示例（均来自 [env-vars](https://code.claude.com/docs/en/env-vars) / [settings](https://code.claude.com/docs/en/settings)）：

- `CLAUDE_CODE_DISABLE_AGENT_VIEW` / `disableAgentView`
- `CLAUDE_CODE_DISABLE_CRON` / 相关 scheduled tasks
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY`
- `disableRemoteControl`、`disableAutoMode`
- `disableBypassPermissionsMode: "disable"` — 阻止 `bypassPermissions` / `--dangerously-skip-permissions`（组织策略常见）

Settings 作用域优先级（**A**，配置系统，**不是** GrowthBook 覆盖链）：Managed > CLI args > Local > Project > User。

### 2.4 官方 **未** 公开发布的内容

在 code.claude.com / docs.anthropic.com 检索范围内，**未见**对下列内容的架构说明：

- `feature()` / `bun:bundle` / DCE 约定  
- `USER_TYPE === 'ant' | 'external'`  
- `tengu_*` 命名约定或完整 flag 列表  
- `CLAUDE_INTERNAL_FC_OVERRIDES`、`/config` Gates 标签页  
- `src/services/analytics/growthbook.ts` 空 payload 防护等实现细节  

这些均归入 **B**（及部分 **C**）。

---

## 3. B 层：三层（及以上）客户端门控

> 以下除非另标，均来自 **仓库源码笔记（非 Anthropic 已发布文档）**，主文：`docs/claude-code/09-feature-flags.md`；交叉引用见各小节。

### 3.1 第一层：编译时 `feature()` + DCE

**目的**：外部用户不应看到（甚至不应下载到）内部功能代码——安全与包体积。

**机制（B）**：

- 通过 `bun:bundle` 的 `feature()`。
- 构建时决定包含/排除；未启用路径被 **Dead Code Elimination** 移除。
- 笔记列出的编译开关类别包括：内部产品面（`BUDDY`、`KAIROS`、`ULTRAPLAN`、`COORDINATOR_MODE`、`BRIDGE_MODE`、`VOICE_MODE`、`PROACTIVE`、`FORK_SUBAGENT`、`DAEMON`）、压缩/优化（`CACHED_MICROCOMPACT`、`CONTEXT_COLLAPSE`、`REACTIVE_COMPACT`、`HISTORY_SNIP`、`TOKEN_BUDGET`…）、安全合规（`ANTI_DISTILLATION_CC`、`BASH_CLASSIFIER`、`TRANSCRIPT_CLASSIFIER`、`NATIVE_CLIENT_ATTESTATION`）。

**安全含义（B）**：即使远程 GrowthBook 被攻破并返回「开启内部功能」，外部构建里对应代码已 DCE，攻击者仍拿不到实现。

### 3.2 第二层：`USER_TYPE`（ant vs external）

**目的**：同一份代码在 Anthropic 内部与外部表现不同（功能分级、调试面、覆盖 UI）。

**机制（B）**：

- `process.env.USER_TYPE` **在构建时被硬编码**（外部 `'external'`，内部 `'ant'`）。
- 源码中大量 `process.env.USER_TYPE === 'ant'`；外部构建中该比较恒为 false（笔记称 200+ 处检查）。
- ant 专属面（笔记表）：内部 slash 命令、额外 CLI 参数、GrowthBook 更短刷新间隔与调试日志、API 错误详情、`CLAUDE_INTERNAL_FC_OVERRIDES`、`/config` Gates UI、额外系统提示规范等。

**与反蒸馏/卧底的关系（B）**：`docs/claude-code/10-anti-distillation.md` — 卧底模式、模型代号隐藏、`ANTI_DISTILLATION_CC` 等均挂在 `USER_TYPE === 'ant'` 与/或编译 `feature()` 上；外部构建中这些路径被去掉或恒 false。

### 3.3 第三层：GrowthBook 远程开关（`tengu_*`）

**目的**：不发版即可灰度、实验、紧急回滚。

**基础设施（B，`09-feature-flags.md`；路径自陈 `src/services/analytics/growthbook.ts`）**：

- SDK：`@growthbook/growthbook`
- **远程评估**：`remoteEval: true`（笔记主张；GrowthBook 官方对 `remoteEval` 语义见 §4，**勿把 SDK 文档当成 Claude Code 源码证明**）
- 刷新：内部约 **20 分钟**，外部约 **6 小时**（**B**；与部分第三方文章「每 60 分钟」不一致 → 见 Open questions）
- 磁盘缓存：跨进程持久化到 `~/.claude.json` 的 `cachedGrowthBookFeatures`
- 用户属性（笔记）：`id`, `deviceID`, `platform`, `accountUUID`, `userType`, `subscriptionType`, `rateLimitTier`, `appVersion`

**命名（B）**：远程 gate 以 `tengu_` 为前缀，后接看似随机的词对（如 `tengu_cobalt_frost`），笔记解释为降低从名称推断路线图的信息泄露。

**示例 gate（B，非完整、非官方清单）**：

| Flag | 笔记所述控制面 |
|------|----------------|
| `tengu_kairos` | KAIROS 总开关 |
| `tengu_session_memory` / `tengu_sm_config` | 会话记忆开关与阈值配置 |
| `tengu_ccr_bridge` | Bridge / Remote Control 相关 |
| `tengu_max_version_config` | 自动更新相关 kill switch |
| `tengu_moth_copse` | 跳过 MEMORY.md 索引 |
| `tengu_herring_clock` | 团队记忆（与 `feature('TEAMMEM')` 组合） |
| `tengu_cobalt_raccoon` | 仅响应式压缩模式等 |

社区 GitHub issue 中用户也讨论过 `tengu_ccr_bridge` 与 `cachedGrowthBookFeatures` 行为（**A/C 混合**：issue 存在，但根因分析含用户侧 token 配置，不能当作架构白皮书）。

### 3.4 第四层（公开产品面）：entitlement + managed/env

与 §2 重叠，但在完整架构里应视为 **与客户端三层并行的外环**：

- 即使客户端 flag 为 true，计划/供应商 entitlement 仍可挡住（**A**）。
- Managed settings 可强制关掉危险模式或整类功能（**A**）。

### 3.5 组合门控范例（B）

笔记中多处显示 **编译开关 ∧ 运行时/远程门** 同时使用：

| 能力 | 组合 | 来源 |
|------|------|------|
| Context Collapse | `feature('CONTEXT_COLLAPSE') && isContextCollapseEnabled()` | `07-context-compression.md` |
| Team Memory | `feature('TEAMMEM')` + GrowthBook `tengu_herring_clock` + auto memory 已开 | `06-memory-architecture.md` |
| Token budget tracker | `feature('TOKEN_BUDGET') ? createBudgetTracker() : null` | `01-agent-loop.md` |
| Anti-distillation | `feature('ANTI_DISTILLATION_CC')`（外部未启用） | `10-anti-distillation.md` |

---

## 4. GrowthBook SDK 机制（官方 GrowthBook 文档，非 Claude Code）

仅用于理解笔记中 `remoteEval: true` 的一般含义：

- [Remote Evaluation](https://docs.growthbook.io/self-host/remote-evaluation)：在私有端点评估，客户端只拿到**已评估结果**，不暴露完整 targeting 规则与未使用 variation。
- [JS SDK](https://docs.growthbook.io/lib/js)：`remoteEval: true`；可用 `cacheKeyAttributes` 限制何时重新评估；`configureCache` 管理本地缓存 TTL / maxAge。

**C**：Claude Code 是否自建 proxy、如何映射到 `api.anthropic.com`、精确缓存策略——笔记有部分描述，本轮未对源码核验。

---

## 5. 调用形态：门控如何挂到命令 / 工具 / 循环

> 主来源 **B**。官方仅侧面确认存在「feature-gated tools」与 flag 冷启动时序问题（changelog）。

### 5.1 `feature()` 的 DCE 友好写法（B）

笔记强调：`feature()` **只能**出现在 `if` 或三元表达式中（不能先赋给变量再判断），否则 Bun tree-shaking 识别失败。条件模块加载用 `require()` 而非静态 `import`：

```typescript
import { feature } from 'bun:bundle'

const module = feature('KAIROS')
  ? require('./kairos.js')
  : null

if (feature('BUDDY') && isBuddyLive()) {
  // 仅内部构建中保留
}
```

来源：`docs/claude-code/09-feature-flags.md`「使用方式」「关键设计决策」§2。

### 5.2 命令注册（B，细节偏薄）

`09-feature-flags.md` 将 `src/commands.ts` 与内部 `docs/07-feature-gates.md` 标为核心源码，并称 ant 有 **24+ 内部命令**。  
**本仓库公开笔记未展开**「每个 slash command 如何在数组里按 `feature()` / `USER_TYPE` / GrowthBook 过滤」的具体注册表代码。  
合理推断（**C**）：命令表在组装时过滤，与工具 `isEnabled` 类似——但 **未在笔记中逐行证实**。

### 5.3 工具门控（B + A 侧面）

- `Tool` 接口含 `isEnabled(): boolean`；`buildTool()` 默认 `isEnabled: () => true`（`02-tool-design.md`）。
- 权限路径上另有 `canUseTool` / `hasPermissionsToUseTool`（执行期授权，**不等于**产品 feature gate，但同属「能否用」纵深）。
- Changelog（**A**）：`--tools` 曾在 flag 冷加载前放行 feature-gated tools → 说明部分工具的可用性与 GrowthBook 就绪时序绑定。

记忆子代理的极端 `canUseTool`（**B**）：`createMemoryFileCanUseTool(memoryPath)` 只允许编辑指定记忆文件（`06-memory-architecture.md`）——这是 **最小权限闸门**，不是 GrowthBook。

### 5.4 Agent 循环与依赖注入（B）

`01-agent-loop.md`：`query()` 通过 `deps` 注入 `callModel` / compact 等；feature 条件宜集中在 `productionDeps()`，避免散落在循环内。`TOKEN_BUDGET` 用三元创建 tracker，是典型「门后对象存在性」模式。

### 5.5 系统提示与缓存交互（B）

`04-system-prompt-cache.md`：

- `USER_TYPE` 与 GrowthBook A/B 会导致不同用户系统提示字节不同（缓存分裂因素）。
- 子代理冻结父进程 `systemPrompt`，避免 GrowthBook cold→warm 导致字节漂移（牺牲最新 flag 可见性换缓存命中）。
- `toolSchemaCache` 防止 flag 翻转改变工具描述字节。
- 遥测事件名含 `tengu_prompt_cache_break`（命名空间与 GrowthBook `tengu_` 一致，但是否同一服务配置 → **C**）。

---

## 6. 覆盖优先级

### 6.1 GrowthBook 值解析（B）

`09-feature-flags.md`「覆盖机制」：

```
优先级（高 → 低）：
1. 环境变量 CLAUDE_INTERNAL_FC_OVERRIDES（JSON，ant-only）
2. /config → Gates → growthBookOverrides（ant-only）
3. GrowthBook 远程评估结果
4. 磁盘缓存（~/.claude.json → cachedGrowthBookFeatures）
5. 代码中的默认值
```

设计意图（笔记）：越临时的覆盖优先级越高；env 方便 eval harness 确定性；Gates UI 方便内部调试。

### 6.2 与官方 opt-out 的关系（A + C）

- `DISABLE_GROWTHBOOK=1`（及 `DISABLE_TELEMETRY` 等同效路径）：**不拉远程**，用 **code defaults**（**A**）。
- 对「已有磁盘缓存是否仍被读取」：GitHub issue [#62382](https://github.com/anthropics/claude-code/issues/62382) 要求文档澄清；**截至本笔记写作，公开文档仍未完整回答该缓存生命周期问题（C / 缺口）**。

### 6.3 配置系统优先级（A，另一条链）

Managed settings / CLI / local / project / user 的优先级见 §2.3——管的是 **用户可见配置与组织策略**，与 §6.1 的 GrowthBook 覆盖链是不同子系统；不要混成一张总表。

---

## 7. 安全相关

### 7.1 空 payload 防护（B）

`09-feature-flags.md`：

```typescript
if (!payload?.features || Object.keys(payload.features).length === 0) {
  return false  // 不清空缓存，防止全面 flag 失效
}
```

意图：服务端 bug 返回空 features 时，**拒绝采纳**，继续用上次有效缓存，避免「所有远程门控能力瞬间全灭」。

另有 `reinitializingPromise`：安全门控检查等待初始化完成，避免读到过期值（**B**）。

### 7.2 Bypass permissions kill switch

| 机制 | 证据 |
|------|------|
| Managed / settings：`disableBypassPermissionsMode: "disable"` | **A** — [settings](https://code.claude.com/docs/en/settings) |
| 远程 GrowthBook kill switch：`bypassPermissionsKillswitch.ts` | **B** — `08-security-review.md`（「通过 GrowthBook 远程控制」；**未给出具体 `tengu_*` 名**） |

权限模式本身含 `bypassPermissions`（**B** 详述 + **A** settings 中 `defaultMode` 枚举含该值）。笔记称远程 kill switch 用于发现滥用时 **不发版全局禁用**。

### 7.3 其他 kill / 紧急面（B / A）

- `tengu_max_version_config`：笔记称自动更新相关 kill switch（**B**）。
- 大量 `DISABLE_*` / `disable*`：用户或组织硬关能力（**A**）——偏「本地/策略 kill」，不依赖远程评估。
- Telemetry 与 GrowthBook 耦合：关遥测亦关 flag 拉取 → 预览功能与远程 killswitch 可能同时失效（**A** 文档已警告「some flagged features may be unavailable」；issue [#58383](https://github.com/anthropics/claude-code/issues/58383) 讨论过 Agent View 曾受此影响，Anthropic 回复称已将部分 gate 与 GrowthBook 解耦 —— **产品会演进，具体列表以当时版本文档为准**）。

### 7.4 反蒸馏与信息泄露纵深（B）

`10-anti-distillation.md` 将门控与保密绑在一起：

```
excluded-strings.txt 检查 → feature() DCE → USER_TYPE 硬编码 → 外部构建产物
```

卧底模式：ant 在外部仓库默认 ON，无 force-OFF；防止内部模型代号进入公开提交。这与「能力门控」共享同一套 compile/user-type 基础设施，但目标是 **保密** 而非产品灰度。

---

## 8. 对 Open-OX 的可学点（架构教训，非方案设计）

仅作「Feature package / capability gate」方向的启发：

1. **分层各管一件事**：编译/打包剔除、构建受众（内外）、远程灰度、组织策略、用户 opt-out——混成一个布尔开关会同时搞砸安全与运营。
2. **远程开 ≠ 代码在**：对敏感能力，远程 flag 只能「点亮已存在的代码」；真正不想泄露的实现应在发行构建中物理剔除（DCE / 分包）。
3. **门控要可组合**：常见模式是 `compileGate && runtimeGate(config|remote)`，而不是单一全局 map。
4. **失败默认要明确**：空远程 payload 时保留上次好值（或显式 defaults），避免控制面故障变成全站功能雪崩；安全权限路径则倾向 fail-closed（见权限笔记）。
5. **覆盖链写清楚且分受众**：内部调试覆盖（env / UI）应高于远程，但对外发行可不暴露；公开文档至少说明「关遥测是否关远程门控」。
6. **注册表与冷启动**：命令/工具若依赖远程门，必须定义 flag 未就绪时的行为（官方曾修过 cold launch 漏放 feature-gated tools）。
7. **产品 entitlement 与工程 flag 分开建模**：计划能不能用、组织允不允许、实验开不开——三套语义，一张 UI 表可以合并展示，但实现上不宜揉成一种存储。

---

## 9. Open questions / gaps

在无 Anthropic 完整源码访问、且本轮未核验 leak mirror 的前提下，仍无法钉死：

1. **`src/commands.ts` / 内部 `docs/07-feature-gates.md` 的真实注册表**：公开教学笔记点名了路径，但未收录完整过滤伪代码。  
2. **GrowthBook 刷新间隔**：笔记（20min ant / 6h external）vs 第三方「60min」——以何为准未知。  
3. **`bypassPermissions` 远程 kill switch 的具体 flag 名与评估属性。**  
4. **`DISABLE_GROWTHBOOK` 是否忽略已有 `cachedGrowthBookFeatures`**（官方 issue 仍在求文档）。  
5. **完整 `tengu_*` 目录与默认值表**：笔记与社区均为抽样；官方不发布。  
6. **`remoteEval: true` 与 Anthropic 后端拓扑**：是否 GrowthBook Proxy、属性 scrubbing、与 analytics 共享通道——仅有笔记级描述。  
7. **发行构建如何注入 `feature()` 集合与 `USER_TYPE`**：Bun 构建配置未在本仓库笔记中展开到可复现级别。  
8. **产品 entitlement（计划/Admin-enabled）在客户端是否也读 GrowthBook，或纯服务端拒绝**：官方 availability 文档未说明实现缝。

---

## 10. 主要来源索引

### A. Anthropic / Claude Code 官方

- https://code.claude.com/docs/en/feature-availability  
- https://code.claude.com/docs/en/env-vars（`DISABLE_GROWTHBOOK`、`DISABLE_TELEMETRY` 等）  
- https://code.claude.com/docs/en/settings（managed settings、`disableBypassPermissionsMode` 等）  
- https://code.claude.com/docs/en/web-scheduled-tasks（`/schedule` 依赖 feature-flag fetching）  
- https://code.claude.com/docs/en/changelog（feature-gated tools / cold GrowthBook）  
- https://github.com/anthropics/claude-code/issues/58383（GrowthBook 与 telemetry 耦合；团队回复）  
- https://github.com/anthropics/claude-code/issues/62382（opt-out 后缓存行为文档缺口）

### B. 仓库源码笔记（非 Anthropic 已发布文档）

- `docs/claude-code/09-feature-flags.md` — 三层门控主文  
- `docs/claude-code/10-anti-distillation.md` — DCE / USER_TYPE / 反蒸馏  
- `docs/claude-code/08-security-review.md` — bypassPermissions kill switch  
- `docs/claude-code/02-tool-design.md` — `isEnabled` / `canUseTool`  
- `docs/claude-code/06-memory-architecture.md` — TEAMMEM + `tengu_herring_clock`  
- `docs/claude-code/07-context-compression.md` — `feature('CONTEXT_COLLAPSE')`  
- `docs/claude-code/04-system-prompt-cache.md` — flag 与 prompt cache  
- `docs/claude-code/01-agent-loop.md` — `TOKEN_BUDGET` / deps 注入  

### GrowthBook 官方（SDK 机制 only）

- https://docs.growthbook.io/lib/js  
- https://docs.growthbook.io/self-host/remote-evaluation  

### 明确未采信为架构权威

- 第三方 Claude Wiki / 非官方 internals 文档（可能过时或混入逆向猜测）  
- 社区 leak mirror 仓库（版权与完整性问题；本轮未做文件级核验）
