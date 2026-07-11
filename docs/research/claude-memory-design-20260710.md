# 调研：Claude Memory 设计（产品 Memory / Claude Code / API Memory Tool）（2026-07-10）

**状态**：完成（基于第一方公开材料：Claude Help Center、Anthropic 产品博文、Claude Code 官方文档、Anthropic API docs；并对照本仓库 `docs/claude-code/` 逆向笔记做核验/扩展）  
**日期**：2026-07-10  
**问题**：Claude 的「记忆」如何分层、写入、注入、遗忘与用户可控？对 Open-OX「modify memory / 长期记忆」（产品想法 §6）有何可学架构？

**范围说明**：本笔记覆盖三条**不同产品面**的记忆系统，不可混为一谈：

1. **Claude.ai 产品 Memory**（跨聊天的用户/项目记忆摘要 + 聊天搜索）
2. **Claude Code / Agent 记忆**（`CLAUDE.md`、auto memory、`MEMORY.md`、subagent memory、compaction）
3. **Claude Developer Platform Memory Tool**（API 侧 client-side `/memories` 文件工具）

**不在范围**：第三方博客对 Auto Dream 的解读（仅作线索）；本仓库逆向笔记中**未在官方文档出现**的实现细节会单独标注为「源码笔记，非 Anthropic 已发布文档」。

**Open-OX 对照基线**：

- 产品想法：`docs/product/ux-expansion-ideas-20260710.md` §6（跨项目品牌记忆 + 可检视「设计宪法」）
- 已有 Claude Code 笔记：`docs/claude-code/06-memory-architecture.md`、`05-content-retrieval.md`、`07-context-compression.md`、`04-system-prompt-cache.md`

---

## 1. 结论摘要

| 缝 | Claude.ai 产品 Memory | Claude Code | API Memory Tool |
|----|----------------------|-------------|-----------------|
| **单位** | 可编辑的 **memory summary / project summary**（合成文本） | **你写的指令**（CLAUDE.md / rules）+ **Claude 写的笔记**（auto memory 文件树） | **client 托管的 `/memories` 文件**（CRUD 工具调用） |
| **写入** | 隐式：每 24h 从聊天历史合成；显式：聊天里「记住…」或 Settings 编辑；导入提取为 edits | 隐式：会话中 Claude 自决是否值得记；显式：「remember…」→ auto memory；用户手写 CLAUDE.md | 模型经 tool call 写文件；应用方执行并持久化 |
| **注入** | 新 standalone / 项目聊天自动带上对应 summary | 会话启动加载 CLAUDE.md（全文）+ MEMORY.md 前 200 行/25KB；主题文件按需 Read | 系统提示强制「先 view memory」；内容靠 tool 按需取，不默认全量塞进 prompt |
| **遗忘** | Pause（停用且暂停期不入合成）/ Reset（永久删）；删聊天 → 24h 内从合成移除；Incognito 永不入记忆 | 用户直接编辑/删除 markdown；关 `autoMemoryEnabled`；`--bare` 跳过加载 | 应用方实现 delete/过期；文档建议定期清理未访问文件 |
| **范围** | 全局（非项目聊天）vs **每项目独立** memory；Incognito 隔离 | Managed / user / project / local CLAUDE.md；auto memory **按 git repo**；subagent 另有 user/project/local 目录 | 完全由应用定义（通常 per-agent / per-project 目录） |
| **可见性** | Settings「View and edit memory」；聊天内可改；引用过去聊天有 citation | `/memory` 浏览；文件系统可 `cat`；UI 显示 Writing/Recalled memory | 开发者完全控制存储与审计 |

**一句话**：Anthropic 把「记忆」拆成 **合成摘要（产品）**、**指令文件 + 索引式笔记（Claude Code）**、**JIT 文件工具（API）** 三套；共同设计原则是 **可检视、可编辑、有明确 scope 边界**，以及 **索引/摘要常驻 + 细节按需**——这对 Open-OX §6「无检视 UI 则不做静默记忆」几乎是直接背书。

---

## 2. 三条产品线如何区分

| 产品线 | 谁拥有存储 | 谁写 | 典型用户 |
|--------|------------|------|----------|
| Claude.ai Memory | Anthropic 云端（随聊天 retention） | 后台合成 + 用户/对话编辑 | claude.ai / Desktop / Mobile |
| Claude Code | 本机 `~/.claude/` 与项目树 | 用户写 CLAUDE.md；Claude 写 auto memory | 终端/IDE 编码 agent |
| API Memory Tool | **你的**基础设施（client-side） | Claude 经 tool call 提议；你的 handler 落盘 | 自建 agent / 长跑工作流 |

来源：

- 产品：https://support.anthropic.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context ；https://www.anthropic.com/news/memory
- Claude Code：https://code.claude.com/docs/en/memory
- API：https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool ；https://www.anthropic.com/news/context-management

---

## 3. Claude.ai / Anthropic 产品 Memory

### 3.1 能力拆分：Memory ≠ Chat Search ≠ Project Knowledge

官方把三件事并列但机制不同：

| 能力 | 机制 | 可用性（文档表述） |
|------|------|-------------------|
| **Memory summary** | 从聊天历史自动合成 key insights；注入新对话 | 全计划（Free–Enterprise）；web / Desktop / Mobile |
| **Search past chats** | RAG 工具调用，按需检索历史聊天 | **付费**计划（Pro/Max/Team/Enterprise） |
| **Project knowledge** | 用户上传的文档/指令/GitHub；可切 RAG 检索 | Projects 功能；与 memory 独立 |

来源：Help Center memory 文；Projects 文 https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects ；RAG for projects https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects

**关键设计点**：Project **knowledge**（显式上传）≠ Project **memory**（从该项目内聊天合成的 summary）。Knowledge 是用户放进知识库的材料；Memory 是从对话里学到的合成。

### 3.2 层：全局 summary vs 项目 summary

- **Standalone（非项目）聊天**：一份跨聊天的 memory synthesis，**每 24 小时**更新，为每个新 standalone 对话提供上下文。合成**不包含** projects 内的聊天。
- **每个 Project**：独立 memory space + dedicated project summary，与其他项目及非项目聊天隔离。

来源：Help Center「How does Claude’s memory work?」/「Project memory and summary」；博文 https://www.anthropic.com/news/memory（「If you use projects, Claude creates a separate memory for each project」）

**用移动聊天管理记忆边界**：把聊天移入/移出 project，会改变它进入哪份 summary（项目 summary vs 全局 summary）。Team/Enterprise 文档明确以此作为管理手段。

来源：https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects（「Move chats to manage Claude’s memory」）

### 3.3 写入 / 更新 / 遗忘

| 操作 | 行为 |
|------|------|
| **隐式合成** | 自动 summarize 对话 → 合成 key insights；约每 24h 更新；创建/修改/删除对话后 24h 内反映到 memory |
| **显式编辑（Settings）** | Settings → Capabilities →「View and edit memory」；铅笔图标可加 custom instructions |
| **显式编辑（聊天内）** | 告诉 Claude「记住…」→ **立即**作用于下一轮对话，不必等每日合成 |
| **Import** | 粘贴他处导出的记忆 → Claude 提取为 individual memory edits；可「Manage edits」；实验性；偏工作相关，个人细节可能被滤掉 |
| **Pause** | 保留已有 memory，但**不用**也不**新建**；暂停期间的对话在重新开启后也**不会**补进合成 |
| **Reset** | **永久删除**全部 memories（含 project memories）；不可撤销 |
| **删聊天** | 从 memory synthesis 移除（随 retention / 24h 更新） |
| **Incognito** | 不入 chat history、不入 memory、不参与 search；也不使用已有 memory |

来源：Help Center memory 文；Import/export https://support.anthropic.com/en/articles/12123587-import-and-export-your-memory-from-claude ；Incognito https://support.claude.com/en/articles/12260368-use-incognito-chats

### 3.4 注入与可见性

- Memory summary **为每个新 standalone 对话提供 context**（文档未公开 prompt 拼装细节 / token 预算）。
- 用户可在 Settings 看到「exactly what Claude remembers」。
- 引用过去对话时有 **citations** 链回原聊天，并可删除特定对话。
- Chat search 以 **tool call** 形式出现在当前对话中（RAG）。

来源：Help Center memory 文「User controls and visibility」「Past chat citations」「Search past chats」

### 3.5 记什么 / 不记什么

**倾向记住（工作向）**：角色与专业上下文、沟通偏好、技术/编码风格、项目细节与进行中的工作。

**刻意不记 / 隔离**：Incognito 聊天；组织级可关「Generate memory from chat history」（Enterprise Owner 关闭会**立即永久删除**全组织 memory synthesis）。

来源：Help Center「What does Claude remember?」「What Claude doesn't remember」「Controls for Enterprise plan owners」；博文强调 work-focused + safety testing（https://www.anthropic.com/news/memory）

### 3.6 与「显式 vs 隐式」

| 类型 | 产品行为 |
|------|----------|
| **隐式** | 后台 24h 合成；默认开启（Enterprise 组织级默认可由 Owner 关） |
| **显式** | 用户口述「记住」；Settings 编辑；Import；移动聊天改 scope |

**冲突/合并**：公开文档**未**描述细粒度冲突解决算法；用户编辑与「告诉 Claude 关注/忽略什么」会调整后续引用。合成是周期性的，显式编辑可跳过等待。

---

## 4. Claude Code / Claude Agent 记忆

### 4.1 官方两层（已发布文档）

Claude Code 官方文档明确：**两个互补系统**，每个会话开始都加载；二者都是 **context，不是强制配置**（硬拦截用 PreToolUse hook）。

| | CLAUDE.md（及 rules） | Auto memory |
|--|----------------------|-------------|
| 谁写 | 你 | Claude |
| 内容 | Instructions / rules | Learnings / patterns |
| Scope | Managed / user / project / local | **Per git repository**（worktrees 共享）；机器本地 |
| 启动加载 | 相关文件**全文**（建议单文件 &lt;200 行） | `MEMORY.md` **前 200 行或 25KB（先到为准）** |
| 用途 | 标准、工作流、架构 | Build 命令、调试洞见、发现的偏好 |

来源：https://code.claude.com/docs/en/memory ；Glossary https://code.claude.com/docs/en/glossary（Auto memory / CLAUDE.md / Compaction）

### 4.2 CLAUDE.md：显式项目/用户/组织记忆

**加载顺序（广 → 窄）**：Managed policy → `~/.claude/CLAUDE.md` → 项目 `CLAUDE.md` / `.claude/CLAUDE.md` → `CLAUDE.local.md`；祖先目录文件在 launch 时加载；**子目录** CLAUDE.md 在 Claude **读到该目录文件时**惰性注入。

**Rules**：`.claude/rules/*.md`；无 `paths` 则与项目 CLAUDE.md 同优先级常驻；有 `paths` 则匹配文件被读取时才加载。

**注入形态（重要）**：CLAUDE.md 以 **system prompt 之后的 user message** 交付，**不是** system prompt 本身——因此是「尽力遵循」而非硬保证。需要硬保证用 hooks / permissions。

**Compact 后存活**：项目根 CLAUDE.md 在 `/compact` 后从磁盘重读并重新注入；嵌套子目录 CLAUDE.md **不会**自动重注，需再次读到该目录才加载。

来源：https://code.claude.com/docs/en/memory（「How CLAUDE.md files load」「Troubleshoot」）；https://code.claude.com/docs/en/how-claude-code-works（context / compaction）；Glossary「CLAUDE.md」「Compaction」

本仓库笔记交叉验证：`docs/claude-code/04-system-prompt-cache.md` 将 CLAUDE.md + MEMORY.md 归入 `userContext`；`05-content-retrieval.md` 描述 nested CLAUDE.md 触发式注入——与官方「subdirectory load on demand」一致。

### 4.3 Auto memory：隐式 + 可审计的文件笔记

**存储**：

```text
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 索引，启动加载（截断）
├── debugging.md       # 主题文件，按需
└── ...
```

`<project>` 由 **git repo** 派生；非 git 则用项目根。可用 `autoMemoryDirectory` 改路径。**不跨机器/云环境共享**。

**写入策略（官方）**：

- 默认开启；`/memory` 开关或 `autoMemoryEnabled: false` 或 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`
- Claude **不是每会话都写**；自决「对未来对话是否有用」
- 用户说「always use pnpm…」「remember that…」→ 写入 auto memory
- 保持 `MEMORY.md` 精简，细节挪到 topic files

**用户控制**：全部是普通 markdown，可编辑/删除；`/memory` 列出已加载的 CLAUDE.md/rules 并打开 auto memory 文件夹；UI 可出现「Writing memory」/「Recalled memory」。

来源：https://code.claude.com/docs/en/memory（「Auto memory」）；Glossary「Auto memory」

本仓库 `06-memory-architecture.md` 额外记录了四类 `MemoryType`（user/feedback/project/reference）、两步保存（主题文件 + MEMORY.md 索引行）、`ensureMemoryDirExists` 等——这些来自标注的源码路径（`src/memdir/`），**官方 memory 页未展开类型枚举**；与官方「index + topic files」结构一致，类型分类作实现细节参考即可。

### 4.4 Subagent 持久记忆（官方）

自定义 subagent 可设 `memory: user | project | local`：

| Scope | 路径 |
|-------|------|
| `user` | `~/.claude/agent-memory/<agent>/` |
| `project` | `.claude/agent-memory/<agent>/`（可进 VCS） |
| `local` | `.claude/agent-memory-local/<agent>/` |

启用后：system prompt 含读写说明；注入该目录 `MEMORY.md` 的 **前 200 行/25KB**；自动打开 Read/Write/Edit。推荐默认 `project` 以便团队共享。

来源：https://code.claude.com/docs/en/subagents（「Enable persistent memory」）

### 4.5 会话工作记忆 vs 持久记忆

官方区分：

- **Session / context window**：当前对话的 working memory（历史、工具输出、已加载指令）。满了则 **compaction**（先清旧工具输出，再摘要对话）。
- **跨会话持久**：CLAUDE.md + auto memory（及 subagent memory）。新会话 **不**自动带上旧会话 transcript；可用 resume/fork。

来源：https://code.claude.com/docs/en/how-claude-code-works（「Sessions are independent」「When context fills up」）；Glossary「Context window」「Compaction」「Session」

### 4.6 Auto Dream / Session Memory 提取管线（源码笔记，非官方文档）

截至 2026-07-10：

- `code.claude.com/docs` 的 llms.txt **无** Auto Dream / Session Memory 专页；官方 memory 页只写 CLAUDE.md + auto memory。
- 本仓库 `docs/claude-code/06-memory-architecture.md`（标注源码 `src/services/SessionMemory/`、`src/services/autoDream/`）描述了额外两层：

| 层（笔记） | 行为摘要 | 官方文档状态 |
|------------|----------|--------------|
| **Session Memory** | post-sampling hook；token/工具调用阈值触发；隔离子代理只改记忆文件；可作 compact 替代路径 | **未**在公开 memory 文档出现 |
| **Auto Dream / KAIROS** | 每日日志 append → 夜间 Orient/Gather/Consolidate/Prune；门控：24h + ≥5 新会话 + 锁 | **未**在公开 docs 出现；第三方文大量转述，**本调研不以之为真源** |

**用法建议**：设计 Open-OX 时可借鉴笔记中的「后台巩固 / 索引修剪」**思想**，但对外宣称「Claude 官方如何做 Dream」时，应标明 **仅有逆向笔记，无 Anthropic 产品文档背书**。

### 4.7 与压缩的关系（官方 + 仓库笔记）

- **官方**：compaction 后根 CLAUDE.md 与 auto memory **从磁盘重载**；仅存在于对话里的指令可能丢失 → 持久规则应写入 CLAUDE.md。
- **仓库 `07-context-compression.md`**：五级压缩管线；Session Memory compaction 作为完整 compact 的可选前置——属实现细节扩展。

---

## 5. API Memory Tool（Developer Platform）

### 5.1 模型

- Tool type：`memory_20250818`，name `memory`
- **Client-side**：Claude 发 tool_use；**你的应用**执行 view/create/str_replace/insert/delete/rename
- 推荐根目录：`/memories`；必须做 path traversal 防护
- 启用时系统提示自动加入协议：**先 view memory 再干活**；假设随时可能被打断，未写入 memory 的进度会丢

来源：https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool ；公告 https://www.anthropic.com/news/context-management

### 5.2 与 context editing / compaction

- **Context editing**：清掉上下文里陈旧 tool results（仍在对话流里）
- **Memory**：把关键信息放到上下文**之外**的文件，跨会话保留
- **Compaction**（server-side 摘要）：可与 memory 并用——摘要管 active context，memory 跨边界保关键事实

评测宣称（Anthropic）：memory + context editing 相对 baseline **+39%**（内部 agentic search eval）；context editing alone **+29%**。

来源：同上 blog + memory tool「Context editing integration」「Using with Compaction」

### 5.3 多会话软件开发模式（官方推荐）

1. **Initializer session**：先写 progress log、feature checklist、startup 脚本引用  
2. **Subsequent sessions**：开场先读这些 artifacts  
3. **End-of-session**：更新 progress；一次只做一个 feature，端到端验证后再标完成  

这与 Claude Code 的「MEMORY.md 索引 + 主题文件」同构，但是 **应用自己编排**，不是 Claude Code 内置 auto memory。

来源：Memory tool docs「Multi-session software development pattern」；指向 Effective harnesses for long-running agents

---

## 6. 架构问题对照（给 Open-OX「modify memory」）

### 6.1 有哪些层？

综合三条产品线，可抽象为四层（Open-OX 设计时建议显式命名，避免混用「memory」一词）：

```text
L0  Working context     当前会话 transcript / 工具结果（会 compact）
L1  Session carry       会话内摘要或检查点（Claude Code compact；产品侧较少公开）
L2  Durable preferences 用户/品牌级长期偏好（Claude.ai summary；CLAUDE.md user；§6.1）
L3  Project memory      项目范围（Claude.ai project summary；CLAUDE.md project；auto memory per-repo；§项目级）
L4  Retrieval corpus    显式知识库（Project knowledge + RAG；非「学到的记忆」）
```

Claude.ai 把 L2/L3 做成 **合成 summary**；Claude Code 把 L2/L3 做成 **markdown 文件**；API 把 L3 做成 **tool 管理的文件目录**。

### 6.2 如何写入 / 更新 / 遗忘？

| 模式 | Claude 做法 | Open-OX 可学点 |
|------|-------------|----------------|
| 隐式提取 | 产品 24h 合成；Code 会话中自决写入 | 可做，但必须可检视（对齐 §6.2） |
| 显式「记住」 | 聊天指令立即生效（产品）；写入 MEMORY.md（Code） | 修改流程里「记住这条设计偏好」应一等公民 |
| 用户编辑真相源 | Settings modal / 编辑 markdown | 「设计宪法」页 = 可编辑真相源 |
| 暂停 vs 重置 | Pause 保留不用；Reset 清空 | 分开「停用」与「清空」降低误伤 |
| 排除单次 | Incognito；移出 project | 「本次修改不入记忆」开关 |

### 6.3 如何注入 prompt？

| 策略 | 谁用 | 含义 |
|------|------|------|
| **全文常驻** | CLAUDE.md、产品 summary（推断） | 小而稳的规则 |
| **截断索引常驻** | MEMORY.md 200 行/25KB | 目录式入口，防爆上下文 |
| **按需 Read / RAG** | topic files；chat search；project knowledge RAG；API memory view | 细节不占启动预算 |
| **强制协议** | API「ALWAYS VIEW MEMORY FIRST」 | 长跑 agent 防失忆 |

Open-OX：品牌/宪法规则宜 **小而常驻**；单次 modify 的证据与长尾偏好宜 **索引 + 按需**。

### 6.4 用户控制 / 可见性 / 可编辑性

三条线一致强调：

1. **能看见 Claude 记住了什么**（Settings / `/memory` / 导出 verbatim）  
2. **能改、能删**（不是黑盒 embedding-only）  
3. **能关**（pause/disable/org kill-switch）  

这与 Open-OX §6.2「记忆可检视 = 信任；黑盒记忆反而吓人」同向。

### 6.5 Scope

| Scope | Claude.ai | Claude Code |
|-------|-----------|-------------|
| User / global | 非项目 summary | `~/.claude/CLAUDE.md`、user rules、user subagent memory |
| Project | 每项目独立 summary + knowledge | 项目 CLAUDE.md、`.claude/rules`、auto memory per-repo、project subagent memory |
| Session | 当前聊天；Incognito 隔离 | 当前 context window；resume 另议 |
| Org | Enterprise 组织级开关与删除 | Managed CLAUDE.md / managed settings |

### 6.6 冲突、摘要、提取管线

| 机制 | 公开程度 |
|------|----------|
| 产品 24h synthesis | 有（周期与「删聊天会更新」）；**无**算法细节 |
| 显式编辑优先于等待合成 | 有（立即作用于下一对话） |
| CLAUDE.md 冲突 | 官方：矛盾指令可能任意选一；需人工审 |
| MEMORY.md 截断 | 有硬限制；细节外置 topic files |
| Auto Dream 巩固/剪枝 | **仅源码笔记** |
| Import → individual edits | 有；可 Manage edits |

### 6.7 显式 vs 隐式（设计建议）

Anthropic 的稳定模式是 **双轨**：

- **显式指令轨**（CLAUDE.md / project instructions / 用户编辑的 summary）= 权威、应优先  
- **隐式学习轨**（auto memory / 24h synthesis）= 辅助、可关、可审计  

Open-OX §6 若只做隐式而无「设计宪法」页，会与第一方产品哲学冲突。

---

## 7. 对本仓库 `docs/claude-code/` 的核验

| 仓库笔记主张 | 与官方对照 |
|--------------|------------|
| MEMORY.md 200 行 / 25KB 启动加载 | ✅ 官方 memory + glossary 一致 |
| 索引 + 主题文件按需 | ✅ 官方一致 |
| CLAUDE.md 与 auto memory 双系统 | ✅ 官方一致 |
| nested CLAUDE.md 惰性加载 | ✅ 官方一致 |
| 文件系统可审计 | ✅ 官方强调 plain markdown |
| Session Memory post-sampling 提取 | ⚠️ 仅笔记；官方未文档化 |
| Auto Dream 四阶段 + 门控 | ⚠️ 仅笔记；官方 docs 无此名 |
| Team memory + secret scanner | ⚠️ 笔记/feature flag；公开 memory 页未写 |
| userContext 注入 MEMORY.md | ✅ 与「启动加载」一致；拼装细节属实现 |

**结论**：以 **官方 docs** 为对外架构真源；以 `06-memory-architecture.md` 为 **实现层假说**，设计时可借鉴，引用时需标注来源层级。

---

## 8. 对 Open-OX 的直接含义（§6）

1. **先做可检视页，再做静默学习**——与 Claude Settings memory modal + `/memory` 同构。  
2. **分开「用户宪法」（显式）与「学到的偏好」（隐式）**——对齐 CLAUDE.md vs auto memory。  
3. **项目 scope 隔离**——Claude.ai project memory 与 Code per-repo memory 都把串味当安全/质量问题。  
4. **注入用「短索引 + 按需细节」**——照搬 200 行/25KB 精神，不必照搬数字。  
5. **Pause ≠ Reset**；提供「本次不入记忆」。  
6. **不要把 transcript 当长期记忆**——长期规则写入 durable store；会话靠 compact/摘要。

---

## 9. 主要来源索引

| 来源 | URL / 路径 |
|------|------------|
| Claude Help：chat search & memory | https://support.anthropic.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context |
| Claude Help：import/export memory | https://support.anthropic.com/en/articles/12123587-import-and-export-your-memory-from-claude |
| Claude Help：incognito | https://support.claude.com/en/articles/12260368-use-incognito-chats |
| Claude Help：projects（含 move chats ↔ memory） | https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects |
| Claude Help：project RAG | https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects |
| Anthropic 博文：Bringing memory | https://www.anthropic.com/news/memory |
| Anthropic 博文：context management | https://www.anthropic.com/news/context-management |
| Claude Code：How Claude remembers your project | https://code.claude.com/docs/en/memory |
| Claude Code：How Claude Code works | https://code.claude.com/docs/en/how-claude-code-works |
| Claude Code：Glossary | https://code.claude.com/docs/en/glossary |
| Claude Code：Subagents memory | https://code.claude.com/docs/en/subagents |
| API：Memory tool | https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool |
| 本仓库笔记 | `docs/claude-code/06-memory-architecture.md` 等 |
| Open-OX 产品想法 | `docs/product/ux-expansion-ideas-20260710.md` §6 |

---

## 10. 文档缺口（诚实边界）

- 产品 Memory **summary 的具体 prompt 模板、长度上限、多记忆条目数据结构**未公开。  
- 产品侧 **冲突解决 / 去重算法**未公开。  
- **Auto Dream / Session Memory** 无 Anthropic 已发布产品文档；仅有本仓库源码向笔记。  
- 本调研 **未登录** claude.ai 实测 Manage memory UI 像素级交互。  
