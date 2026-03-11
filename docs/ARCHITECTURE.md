# Open-OX AI 架构文档

## 一、概述

Open-OX 是一个生产级 AI 引擎，支持多种运行模式：**Agent**（Tool-calling）、**Code Agent**（代码生成）、**Skill**（单技能）、**Flow**（预定义工作流）。核心设计基于「技能路由 + 提示词组合 + 工具执行」的模块化架构。

---

## 二、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               User Request                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          processInput() 主入口                                    │
│   mode: agent | code_agent | skill | flow                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
    ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
    │  Agent 模式   │          │ Code Agent    │          │ Skill/Flow     │
    │  (默认)       │          │ 模式          │          │ 模式          │
    └───────┬───────┘          └───────┬───────┘          └───────┬───────┘
            │                          │                          │
            ▼                          ▼                          ▼
    ┌───────────────┐          ┌───────────────────────────────────────────────┐
    │  Skill Router │          │  Architecture Planner → Task Graph            │
    │  (Embedding)  │          │  Skill Router → LLM + Tools (Skills+System)   │
    │       ↓       │          │  Tool Executor → Verifier → Memory → Recovery │
    │  LLM + Tools  │          └───────────────────────────────────────────────┘
    │       ↓       │
    │  Skill Exec   │
    └───────────────┘
```

---

## 三、运行模式

| 模式 | 说明 | 触发方式 |
|------|------|----------|
| **agent** | Tool-calling Agent，LLM 自主选择并调用 skills | 默认，或 `mode: "agent"` |
| **code_agent** | 生产级 Code Agent，含架构规划、系统工具、校验、回滚 | `mode: "code_agent"` |
| **skill** | 单 skill 执行，可指定或由 Router 选择 | `skill: "summarize"` 或 `mode: "skill"` |
| **flow** | 预定义 skill 链顺序执行 | `flow: "article_writer"` |

---

## 四、目录结构

```
ai/
├── index.ts                    # 主入口 processInput()
├── types.ts                    # 核心类型定义
│
├── agent/                      # Agent 执行器
│   ├── agentExecutor.ts        # 通用 Tool-calling Agent
│   ├── codeAgentExecutor.ts    # Code Agent（完整流程）
│   └── toolAdapter.ts          # Skills → OpenAI Function 格式
│
├── planner/                    # 规划层
│   ├── architecturePlanner.ts # 架构规划（LLM）
│   ├── taskGraph.ts           # 任务图 DAG、拓扑排序
│   ├── types.ts
│   └── index.ts
│
├── router/                     # 意图路由
│   ├── embeddingRouter.ts      # Embedding 向量检索 TopK
│   ├── llmRouter.ts            # LLM 从 TopK 中选一
│   └── index.ts
│
├── composer/                   # 提示词组合
│   ├── promptComposer.ts       # 运行时拼装
│   └── dslEngine.ts            # Handlebars-like DSL 引擎
│
├── executor/                   # 执行层
│   ├── runSkill.ts             # 单 skill 执行
│   └── workflowEngine.ts       # Flow 顺序执行
│
├── registry/                   # 注册表
│   └── skillRegistry.ts        # Skill 集中管理
│
│
├── prompts/dsl/                # 全局 DSL 片段
│   ├── system.md
│   ├── memory.md
│   ├── tools.md
│   └── output_json.md
│
├── systems/                    # Prompt Engine: 系统角色（AI 建站）
│   ├── planner.md              # 站点规划
│   ├── frontend.md             # 前端代码生成
│   ├── codefix.md              # 代码修复
│   └── reviewer.md              # 代码审查
│
├── skills/                     # 技能定义
│   ├── index.ts                # 集中导出（通用 skills）
│   ├── summarize/              # skill.ts + prompt.md
│   ├── section.hero.md         # Prompt Engine: Hero 区块
│   ├── section.feature.md      # Prompt Engine: Feature 区块
│   └── layout.landing.md       # Prompt Engine: Landing 布局
│
├── templates/                  # Prompt Engine: 组合模板
│   ├── generate_section.md
│   ├── generate_layout.md
│   ├── plan_site.md
│   ├── fix_code.md
│   └── tool_call.md
│
├── dsl/                        # Prompt Engine: 输出与设计规则
│   ├── output_json.md
│   ├── output_tsx.md
│   └── design_rules.md
│
├── tools/                      # 系统工具（Code Agent）
│   ├── systemTools.ts          # write_file, read_file, exec_shell, list_dir
│   ├── types.ts
│   └── index.ts
│
├── verifier/                   # 代码校验
│   └── index.ts                # lint / build / typecheck
│
├── memory/                     # 会话状态
│   ├── sessionMemory.ts        # 会话、事件、文件记录
│   ├── types.ts
│   └── index.ts
│
├── recovery/                   # 失败恢复
│   └── index.ts                # 备份、回滚、重试
│
└── flows/                      # 预定义工作流
    ├── index.ts
    └── article_writer.ts
```

---

## 五、Prompt Engine（AI 建站）

专为 AI 建站 Agent 设计的提示词结构，与 composer/dslEngine 配合使用。

### 5.1 systems/ - 系统角色

| 文件 | 用途 |
|------|------|
| `planner.md` | 站点架构规划，输出 JSON 结构 |
| `frontend.md` | 前端代码生成（React/Next.js/TSX） |
| `codefix.md` | 根据 linter/TS 错误修复代码 |
| `reviewer.md` | 代码审查，输出 approved + issues |

### 5.2 skills/ - 区块与布局技能

| 文件 | 用途 |
|------|------|
| `section.hero.md` | Hero 区块（headline, CTA, 变体） |
| `section.feature.md` | Feature 区块（卡片网格） |
| `layout.landing.md` | 完整 Landing 页面布局 |

### 5.3 templates/ - 组合模板

| 文件 | 用途 |
|------|------|
| `generate_section.md` | 生成单个 section 的 DSL 模板 |
| `generate_layout.md` | 生成完整 layout 的 DSL 模板 |
| `plan_site.md` | 规划站点的 DSL 模板 |
| `fix_code.md` | 修复代码的 DSL 模板 |
| `tool_call.md` | Tool 调用决策的 DSL 模板 |

### 5.4 dsl/ - 输出与设计规则

| 文件 | 用途 |
|------|------|
| `output_json.md` | JSON 输出格式约束 |
| `output_tsx.md` | TSX 输出格式约束 |
| `design_rules.md` | 间距、字体、颜色、响应式规则 |

---

## 六、核心模块详解

### 6.1 主入口 `ai/index.ts`

- **`processInput(userInput, options)`**：统一入口，根据 `mode` 分发到不同执行路径
- **模式推断**：`flow` 或 `skill` 存在时自动推断，否则默认 `agent`

### 6.2 Agent 执行器

#### `agentExecutor.ts`（通用 Agent）

- **流程**：Embedding Router → TopK Skills → LLM（带 tools）→ 循环执行 tool_calls 直到返回最终回答
- **Tools**：仅 Skills（summarize、translate、rewrite、code_generate 等）
- **选项**：`useRouter`、`topK`、`maxIterations`、`systemPrompt`、`memory`

#### `codeAgentExecutor.ts`（Code Agent）

- **流程**：
  1. `planArchitecture`：LLM 规划页面/组件/模块
  2. `buildTaskGraphFromArchitecture`：生成 DAG 任务图
  3. 创建 Session，写入 Memory
  4. 组合 Skills + System Tools：`write_file`、`read_file`、`exec_shell`、`list_dir`
  5. Agent 循环：LLM 决策 → 执行 tool → 结果回传
  6. 若有 `write_file`：`verify`（lint）
  7. 校验失败：`rollbackAll` 回滚

### 6.3 Planner（规划层）

| 模块 | 职责 |
|------|------|
| **Architecture Planner** | 根据用户请求规划 `nodes`（page/component/layout/module），输出 JSON |
| **Task Graph** | 从架构生成 DAG，`topologicalSort` 得到执行顺序，`getRunnableTasks` 获取可执行任务 |

**ArchitectureNode**：`id`、`type`、`name`、`description`、`dependsOn`、`meta`  
**TaskNode**：`id`、`type`、`skill`、`input`、`dependsOn`、`status`、`result`

### 6.4 Router（意图路由）

| 模块 | 职责 |
|------|------|
| **Embedding Router** | 对 user input 与 skills 做 embedding，余弦相似度排序，返回 TopK |
| **LLM Router** | 在 TopK 候选中由 LLM 选出一个 skill |

**两阶段**：`routeIntent` = `routeByEmbedding` + `selectSkillWithLLM`

### 6.5 Composer（提示词组合）

- **Prompt DSL**：支持 `{{var}}`、`{{#if var}}`、`{{#each arr}}`、`{{#unless var}}`
- **`composePrompt(ctx)`**：从 `ai/prompts/dsl/` 加载 system、output_json 等，与 skill prompt、memory、tools 组合

### 6.6 Tool System（系统工具）

网站生成 Agent 常用工具：

| Tool | 参数 | 说明 |
|------|------|------|
| `read_file` | `path` | 读取文件内容 |
| `write_file` | `path`, `content` | 写入文件，自动创建目录 |
| `search_code` | `pattern`, `path?` | 代码搜索（ripgrep） |
| `exec_shell` | `command`, `cwd?` | 执行 shell 命令 |
| `install_package` | `package`, `dev?` | 安装 npm 包（pnpm add） |
| `format_code` | `path` | 格式化代码（Prettier） |
| `run_build` | `script?` | 运行 build 脚本 |
| `list_dir` | `path?` | 列出目录内容 |

- **路径安全**：`resolvePath` 限制在 workspace 内，不允许跳出

### 6.7 Verifier（代码校验）

- **类型**：`lint`、`build`、`typecheck`
- **命令**：`pnpm run lint`、`pnpm run build`、`pnpm exec tsc --noEmit`
- **`formatErrorsForLLM`**：将失败结果格式化为可反馈给 LLM 的文本

### 6.8 Memory（会话状态）

- **Session**：`sessionId`、`userRequest`、`events`、`writtenFiles`、`architecturePlan`、`taskGraph`、`retryCount`
- **`appendEvent`**：记录 tool/skill/plan/error
- **`recordWrittenFile`**：记录写入文件，用于 rollback
- **`getContextSummary`**：生成供 LLM 使用的上下文摘要

### 6.9 Recovery（失败恢复）

- **`backupBeforeWrite`**：写入前备份已存在文件
- **`rollbackFile`** / **`rollbackAll`**：回滚到备份或删除新文件
- **`withRetry`**：带重试的异步执行

### 6.10 Skill 定义

每个 skill 包含：

- **metadata**：`name`、`description`、`category`、`examples`、`inputSchema`、`prompt`、`promptVersion`
- **prompt.md**：技能说明与规则
- **inputSchema**：`"type - description"` 格式，如 `content: "string - the text to summarize"`

**新增 skill**：在 `ai/skills/` 下新建目录，在 `ai/skills/index.ts` 中注册。

---

## 六、数据流

### Agent 模式

```
User Input
    → routeByEmbedding (TopK skills)
    → skillsToTools (转为 OpenAI tools)
    → LLM chat (tools)
    → [tool_calls] ? runSkill → 结果回传 → 继续 LLM
    → 无 tool_calls → 返回 content
```

### Code Agent 模式

```
User Input
    → createSession
    → planArchitecture
    → buildTaskGraphFromArchitecture
    → updatePlan, appendEvent
    → routeByEmbedding (TopK skills)
    → skillsToTools + systemTools
    → Agent 循环
        → write_file: backupBeforeWrite, executeSystemTool, recordWrittenFile
        → 其他 tool: executeSystemTool / runSkill
    → verify (lint)
    → 失败 ? rollbackAll
    → 返回 content, toolCalls, verified, architecturePlan
```

### Skill / Flow 模式

```
Skill: routeIntent → 选 skill → runSkill
Flow:  flows[name] → runWorkflow (顺序执行各 step)
```

---

## 七、API 接口

### POST `/api/ai`

**Request Body**

```json
{
  "input": "string",           // 必填
  "mode": "agent" | "code_agent" | "skill" | "flow",
  "skill": "string",            // skill 模式
  "flow": "string",            // flow 模式，如 "article_writer"
  "memory": "string"            // 可选，上下文记忆
}
```

**Response**

```json
{
  "content": "string",
  "toolCalls": [...],           // agent / code_agent
  "iterations": 0,              // agent
  "sessionId": "string",        // code_agent
  "architecturePlan": {...},    // code_agent
  "verified": true,             // code_agent
  "skill": "string",            // skill 模式
  "steps": [...]                // flow 模式
}
```

---

## 八、配置

### 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | API Key |
| `OPENAI_API_URL` | Base URL（兼容 OpenAI 的 endpoint） |
| `OPENAI_MODEL` | 主模型 ID |
| `OPENAI_EMBEDDING_MODEL` | Embedding 模型，默认 `text-embedding-3-small` |

### 模型配置 `lib/config/models.ts`

- 定义 `MODELS` 映射，`getModelId()` 从环境变量读取并校验

---

## 九、扩展指南

### 新增 Skill

1. 创建 `ai/skills/<name>/skill.ts` 和 `prompt.md`
2. 在 `ai/skills/index.ts` 中 import 并加入 `skillList`

### 新增 Flow

1. 创建 `ai/flows/<name>.ts`，导出 `FlowStep[]`
2. 在 `ai/flows/index.ts` 中注册

### 新增系统工具

1. 在 `ai/tools/systemTools.ts` 的 `systemTools` 中加入定义
2. 在 `executeSystemTool` 的 switch 中实现逻辑

---

## 十、附录：类型与接口

### ProcessInputOptions

```ts
{
  mode?: "agent" | "code_agent" | "skill" | "flow";
  skill?: string;
  flow?: keyof typeof flows;
  useRouter?: boolean;
  topK?: number;
  maxIterations?: number;
  systemPrompt?: string;
  memory?: string;
}
```

### ProcessResult

```ts
{
  content: string;
  toolCalls?: Array<{ name, args, result }>;
  iterations?: number;
  skill?: string;
  steps?: Array<{ skill, output }>;
  sessionId?: string;
  architecturePlan?: unknown;
  verified?: boolean;
}
```

### SkillMetadata

```ts
{
  name: string;
  description: string;
  category: string;
  examples: string[];
  inputSchema: Record<string, string>;
  prompt: string;
  promptVersion?: string;
  tools?: string[];
}
```
