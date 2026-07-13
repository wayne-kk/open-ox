# 调研：AI Project Intelligence Layer 相关技术（2026-07-13）

**状态**：完成（基于第一方公开材料：官方文档、规范、第一方 GitHub README；并对照本仓库 `AGENTS.md`、`.agents/skills/`、`docs/claude-code/`、既有调研笔记）  
**日期**：2026-07-13  
**问题**：用户提出的 **AI Project Intelligence Layer**（代码优先的知识层，使 agent 知晓既有组件/API/实体、避免重复、理解架构、并从源码自动同步知识）——今日有哪些**可落地**的技术能解决或部分解决其痛点？如何映射到 Component/API registry、scanner、知识图、MCP、sync CLI、agent review？

**范围说明**：

1. 面向 **Next.js / TypeScript AI website builder（open-ox）** 与 **Cursor / Claude Code 等人机协作 agent** 的务实选型，不是学术综述。
2. **Code First（从代码扫描同步知识）** 与 **DSL First（schema → 生成代码）** 两条路径都覆盖，但明确二者职责不同。
3. 不实现产品代码；不臆造未在一手来源中出现的产品能力。一手来源含糊时标注「一手来源未证实」。

**Open-OX 对照基线**：

- Agent 入口：`AGENTS.md`（skills / triage / domain docs；含 Next.js agent rules 块）
- Skills：`.agents/skills/README.md`（intake → grilling → to-prd → implement；含 `code-review`、`domain-modeling`、`research` 等）
- Domain：`CONTEXT.md` + `docs/adr/`（见 `docs/agents/domain.md`）
- Claude Code 对照笔记：`docs/research/claude-memory-design-20260710.md`、`docs/claude-code/06-memory-architecture.md`

**用户方案中的典型构件（本文对照对象）**：

| 用户设想 | 本文映射关键词 |
|----------|----------------|
| `.ai/knowledge/*.json` 等结构化 registry | JSON/YAML registry |
| AST scanners → 组件/API/实体清单 | TS Compiler API / ts-morph / tree-sitter |
| Knowledge graph | 结构化边表 vs Neo4j / Sourcegraph Code Graph |
| MCP `searchComponent` / `searchAPI` | MCP Tools + 自建 server |
| `pnpm ai:sync` | 扫描 CLI + CI |
| Plan / Reuse / Review / Sync agents | Rules / Skills / Hooks / ESLint / ADR |
| 可选 DSL-first 生成 | Prisma / OpenAPI / GraphQL codegen / Amplify Gen2 |

---

## 1. 问题与范围

### 1.1 痛点（用户原意复述）

| # | 痛点 | Intelligence Layer 期望 |
|---|------|-------------------------|
| P1 | AI 不知道既有组件 → 重复 UI / 不一致 | Component registry + 强制查询 |
| P2 | AI 重造 API → 冗余端点 | API registry / OpenAPI 清单 |
| P3 | 知识不累积（prompt + 局部代码 ≠ 架构/能力/设计/业务关系） | 可版本化、可同步的项目知识 |
| P4 | 需要：registries、AST scanners、KG、MCP、agent pipelines、可选 DSL | 分层技术栈，而非单一银弹 |

### 1.2 调研范围

- **A** 代码分析 / 提取（Code → Registry）
- **B** 代码库索引 / 检索（给 agent 用）
- **C** 知识存储与图
- **D** Agent 工具接口（MCP / Rules / Skills / Hooks）
- **E** DSL / schema 驱动生成（与 Code First 对照）
- **F** 执行与审查（CI / review / ADR）

### 1.3 不在范围

- 具体 open-ox 产品实现或 `.ai/knowledge` schema 定稿
- 第三方「Top 10 AI coding tools」类博客合集（仅作线索时降置信）

---

## 2. 技术地图（总览表）

| 技术 | 类别 | 解决的痛点 | 成熟度 | 一手来源 |
|------|------|------------|--------|----------|
| TypeScript Compiler API | Scanner | P1–P3（类型感知提取） | 生产可用；API 演进需跟版本 | [TS Wiki: Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) |
| ts-morph | Scanner | P1–P3（易用 AST 包装） | 生产可用 | [dsherret/ts-morph](https://github.com/dsherret/ts-morph)、[ts-morph.com](https://ts-morph.com/) |
| tree-sitter / tree-sitter-typescript | Scanner / Repo map | P1–P3（快速语法树；无类型） | 生产可用 | [tree-sitter](https://github.com/tree-sitter/tree-sitter)、[tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript) |
| typescript-eslint 自定义规则 | Enforcement | P1–P2（复用门禁） | 生产可用 | [Custom Rules](https://typescript-eslint.io/developers/custom-rules) |
| CodeQL | Pattern / CI | P2 部分；安全/模式查询为主 | 生产可用（偏安全扫描） | [About CodeQL](https://codeql.github.com/docs/codeql-overview/about-codeql/)、[github/codeql](https://github.com/github/codeql) |
| Zod `toJSONSchema` + zod-openapi | API schema | P2 | 生产可用 | [zod.dev/json-schema](https://zod.dev/json-schema)、[samchungy/zod-openapi](https://github.com/samchungy/zod-openapi) |
| next-openapi-gen / next-swagger-doc / tsoa | OpenAPI from routes | P2 | 可用；App Router 生态分散 | 各项目 README（见 §3.1） |
| Cursor semantic search + Instant Grep | Retrieval | P1–P3（会话内检索） | 生产可用（闭源索引） | [Cursor: Semantic & Agentic Search](https://cursor.com/docs/agent/tools/search) |
| Cursor Rules / AGENTS.md / Skills / Hooks | Agent pipeline | P1–P4（指令与强制） | 生产可用 | [Rules](https://cursor.com/docs/rules)、[Skills](https://cursor.com/docs/skills)、[Hooks](https://cursor.com/docs/hooks) |
| Claude Code CLAUDE.md + auto memory | Agent memory | P3 部分（指令+笔记，非组件 registry） | 生产可用 | [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) |
| Aider repo map | Retrieval | P1–P3（符号图+Token 预算） | 生产可用 | [aider.chat/docs/repomap](https://aider.chat/docs/repomap.html) |
| Continue `@` providers + MCP | Retrieval | P1–P3 | 生产可用；部分旧 provider 已弃用 | [Continue Context Providers](https://docs.continue.dev/customize/deep-dives/custom-providers) |
| Sourcegraph Cody Code Graph / OpenCtx / MCP | Retrieval / Graph | P1–P3（企业场景） | 可用；依赖 Sourcegraph 实例 | [Cody Code Graph](https://sourcegraph.com/docs/cody/core-concepts/code-graph)、[Agentic context](https://sourcegraph.com/docs/cody/capabilities/agentic-context-fetching) |
| Repomix（含 MCP） | Repo packing | P3 部分（整库打包，非结构化 registry） | 生产可用；MCP 标 experimental | [repomix.com](https://repomix.com/guide)、[MCP Server](https://repomix.com/guide/mcp-server) |
| code2prompt | Repo packing | P3 部分 | 生产可用 | [mufeedvh/code2prompt](https://github.com/mufeedvh/code2prompt) |
| LSP / TypeScript language service | Capability surface | P1–P2（定义/引用查询） | 标准成熟；agent 直接用 LSP 的产品少 | [LSP overview](https://microsoft.github.io/language-server-protocol/)、[LSP 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/) |
| JSON/YAML registries | Storage | P1–P3 | 极成熟 | 惯例；无单一规范 |
| SQLite + 本地 embeddings | Storage | P3 检索 | 常见于 agent 工具 | Continue 文档（docs 本地 embeddings）；非统一标准 |
| Neo4j | Graph DB | P3 关系查询 | DB 成熟；「代码 KG 产品」多为第三方 | [Neo4j graph DB](https://neo4j.com/docs/getting-started/graph-database/) |
| GitHub Dependency graph | Package graph | **不是**应用内组件/API 图 | 生产可用（供应链） | [About the dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph) |
| MCP（规范 + Tools） | Agent interface | P1–P4 查询面 | 规范成熟 | [MCP Spec](https://modelcontextprotocol.io/specification/2025-11-25)、[Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) |
| `@modelcontextprotocol/server-filesystem` | MCP ref server | 文件读写，非 registry | 参考实现 | [servers README](https://github.com/modelcontextprotocol/servers)、[filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) |
| `github/github-mcp-server` | MCP | GitHub 平台操作；非本地符号 registry | 官方生产 | [github/github-mcp-server](https://github.com/github/github-mcp-server) |
| Prisma / GraphQL Codegen / Amplify Gen2 | DSL → code | P2–P3（生成侧一致性） | 生产可用 | 见 §3.5 |
| Winglang | Cloud DSL | 云基础设施统一模型 | OSS 存在；与 Next.js UI builder 弱相关 | [winglang/wing](https://github.com/winglang/wing) |
| ADR + CONTEXT.md | Architecture memory | P3–P4 | 本仓库已实践 | `docs/agents/domain.md`、`CONTEXT.md` |

---

## 3. 按层拆解

### 3.1 Scanner / Code → Registry（A）

#### TypeScript Compiler API

- **是什么**：通过 `typescript` 包程序化访问 `Program`、`SourceFile` AST、`TypeChecker`，可遍历语法树并查询语义类型。
- **官方能力**：`createProgram`、AST 遍历、Type Checker、增量 watcher / Language Service 入口等——Wiki 明确这些是分析与转换的官方路径。
- **限制**：Wiki 长期标注 API **非稳定**（历史 disclaimer：breaking changes 会按版本记录）；自己写 scanner 样板多；需正确加载 `tsconfig` 才能得到可靠类型信息。
- **映射**：适合 **Component/API/Entity scanner** 的「真相源」层——能分辨 `Button` 是组件还是变量、导出类型、调用签名。
- **来源**：https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

#### ts-morph

- **是什么**：TypeScript Compiler API 的高层包装，面向静态分析与程序化改代码。
- **官方能力**：`Project` 加载源文件、导航/查询、内存中修改后保存；可回退到底层 `compilerNode` / `TypeChecker`。
- **限制**：README 称仍在积极开发；大仓库全量 `Project` 内存与冷启动成本需实测（一手文档未给 open-ox 规模基准）。
- **映射**：实现 `pnpm ai:sync` 类 CLI 时，往往比直接 Compiler API **更快落地**。
- **来源**：https://github.com/dsherret/ts-morph 、https://ts-morph.com/

#### tree-sitter / tree-sitter-typescript

- **是什么**：增量解析库 + TS/TSX 语法；产出 **concrete syntax tree**，**不做** TypeScript 类型检查。
- **官方能力**：快速、容错、跨语言；TS 与 TSX 是两个 grammar。
- **限制**：无 `TypeChecker` → 难可靠区分同名符号、重载、类型别名；适合「符号轮廓 / repo map」，不适合「类型级 API 契约」。
- **映射**：Aider repo map、Repomix compress 等路径证明其适合作 **轻量索引**；open-ox 的 registry 若需类型准确，应 **TS API / ts-morph 为主，tree-sitter 为辅**。
- **来源**：https://github.com/tree-sitter/tree-sitter 、https://github.com/tree-sitter/tree-sitter-typescript 、https://tree-sitter.github.io

#### ESLint / typescript-eslint 自定义规则

- **是什么**：在 lint 时对 AST（及可选类型信息）执行规则；可做成 CI 门禁。
- **官方能力**：`@typescript-eslint/utils` 的 `RuleCreator`；typed rules 可拿 `getParserServices(context).program` 用 TypeChecker；插件打包规则。
- **限制**：规则适合 **局部、可判定** 约束（如禁止直接 `createElement('button')`、强制从 `@/components/ui` 导入）；**不能**替代「先 search registry」的完整 agent 工作流；误报/漏报取决于规则启发式。
- **映射**：Enforcement 层——「Reuse existing」的 **硬闸门**，与 MCP 软查询互补。
- **来源**：https://typescript-eslint.io/developers/custom-rules 、https://eslint.org/docs/latest/extend/custom-rules

#### CodeQL

- **是什么**：把代码建成查询数据库，用 QL 做路径/模式分析；GitHub code scanning 的引擎。
- **官方能力**：多语言库；自定义 query；CLI / VS Code / code scanning。
- **限制**：主叙事是 **安全与缺陷变体发现**，不是「组件目录产品」；为 UI 组件 registry 写 query 可行但 **运维重**（建库、增量、CI 时长）；对 agent 实时 `searchComponent` 延迟不友好。
- **映射**：可选 **CI 审计**（找重复 API 模式、危险调用），不宜作为 day-1 registry 查询后端。
- **来源**：https://codeql.github.com/docs/codeql-overview/about-codeql/ 、https://github.com/github/codeql

#### OpenAPI：从代码生成（Next.js / Zod / tsoa）

| 方案 | 一手能力摘要 | 对 App Router 的含义 |
|------|--------------|----------------------|
| **Zod `z.toJSONSchema()`** | Zod 4 原生转 JSON Schema / 可选 `openapi-3.0` target | 契约在 Zod 时，可稳定导出 schema 片段 |
| **zod-openapi** | 用 Zod + `createDocument` 组装 OpenAPI 3.x | 需显式声明 paths；不是自动扫 `app/api` |
| **next-swagger-doc** | 读 JSDoc `@swagger` 生成 spec；文档含 Next 13 `app/api` 示例 | **依赖注释质量**；非纯类型推导 |
| **next-openapi-gen** | 扫描 route handlers + JSDoc；支持 Zod/TS；宣称 App Router | 社区工具；成熟度需自测（一手 README 声称支持） |
| **tsoa / tsoa-next** | Controller/装饰器 → OpenAPI + 路由；可选 Zod `@Validate` | 偏 Express 风格控制器；与纯 `app/api/**/route.ts` 惯例不完全同构 |

- **关键缺口（一手来源层面）**：Next.js **官方**并未提供「从 App Router 自动导出完整 OpenAPI」的一等公民 API（一手未找到 Next.js docs 中的官方 codegen）。实践是 **注释扫描 / Zod 手组 / 装饰器框架 / 第三方扫描器**。
- **映射**：API registry 可存 `openapi.json` 或精简 JSON；scanner 可「路由文件导出 HTTP method + Zod body」→ registry，OpenAPI 作交换格式。
- **来源**：https://zod.dev/json-schema 、https://github.com/samchungy/zod-openapi 、https://github.com/jellydn/next-swagger-doc 、https://github.com/tazo90/next-openapi-gen 、https://github.com/tsoa-next/tsoa-next

#### Zod schema introspection

- **官方**：`z.toJSONSchema(schema, { target, io, cycles, ... })`；可输出 Draft 2020-12 或 OpenAPI 3.0 Schema Object。
- **限制**：部分 Zod 类型「不可表示」时默认 throw（可设 `unrepresentable: "any"`）；transforms 的 input/output 需选 `io`。
- **映射**：Entity / DTO registry 的直接原料；与 API registry 对齐。
- **来源**：https://zod.dev/json-schema

---

### 3.2 Codebase indexing / retrieval for agents（B）

#### Cursor：索引、搜索、Rules、Skills、Hooks

| 能力 | 一手文档要点 | 对 Intelligence Layer |
|------|--------------|----------------------|
| **Semantic search** | 代码切块 → embedding → 向量库；约 5 分钟增量同步；与 grep 组合据文档称提升准确率 | 缓解 P1–P3 **会话检索**，但 **不是**可版本化的组件 registry |
| **Instant Grep** | 符号/字符串精确匹配 | 适合「已知名」；不知名时依赖 semantic |
| **Explore subagent** | 并行搜索、摘要回主会话 | 类似「先探索再改」工作流 |
| **AGENTS.md / Rules** | 项目指令；嵌套 AGENTS.md；`.cursor/rules/*.mdc` 可 glob | 可写「创建 UI 前必须查 registry」——**软约束** |
| **Skills** | `.cursor/skills` / `.agents/skills`；agent 按相关性选用 | open-ox 已有 skills 布局 |
| **Hooks** | `preToolUse` 等可 **block** 工具调用 | 比 CLAUDE.md 更接近「强制」；可拦「未查询就写文件」类行为（需自写 hook 逻辑） |

- **限制**：索引算法与存储细节闭源；文档强调 **不把源码明文存服务端**（embeddings + 客户端解密）。**没有**公开的「导出组件注册表 API」。
- **来源**：https://cursor.com/docs/agent/tools/search 、https://cursor.com/docs/rules 、https://cursor.com/docs/skills 、https://cursor.com/docs/hooks 、https://agents.md/

#### Claude Code：CLAUDE.md + auto memory

- **官方**：两套互补——用户写的 `CLAUDE.md`（指令）与 Claude 写的 auto memory（`MEMORY.md` 索引 + 主题文件）；会话开始加载；**当作 context，非强制配置**；要硬拦用 **PreToolUse hook**。
- **限制**：记忆是 **自然语言笔记**，不是结构化 component/API graph；`MEMORY.md` 有行数/字节加载上限（官方文档与本仓库 `docs/claude-code/06-memory-architecture.md` 一致方向）。
- **映射**：适合 P3 的「约定与偏好」；**不能**单独解决 P1/P2 去重。
- **来源**：https://code.claude.com/docs/en/memory ；内部对照：`docs/research/claude-memory-design-20260710.md`、`docs/claude-code/06-memory-architecture.md`

#### Aider repo map

- **官方**：用 tree-sitter 抽符号定义/引用；文件依赖图上做 **graph ranking**，在 `--map-tokens`（默认约 1k）预算内选出最相关片段塞进 prompt。
- **限制**：是 **每次请求的压缩地图**，不是持久 registry；弱模型可能被 map 搞混（FAQ：可默认关闭）。
- **映射**：开源侧最接近「轻量知识图 → agent context」的参考实现；可借鉴 ranking，但 open-ox 仍应落盘 JSON。
- **来源**：https://aider.chat/docs/repomap.html 、https://aider.chat/2023/10/22/repomap.html

#### Continue.dev

- **官方**：`@File` / `@Code` / `@Repository Map` / `@Tree` 等；**推荐用 MCP** 扩展；`@Codebase` / `@Folder` / `@Docs` 等部分路径 **deprecated**，导向「codebase awareness」新指南与 MCP。
- **映射**：说明业界从「内置一堆 @provider」迁到 **MCP + 专用 awareness**；open-ox 自建 registry MCP 符合这一趋势。
- **来源**：https://docs.continue.dev/customize/deep-dives/custom-providers 、https://docs.continue.dev/reference/

#### Sourcegraph Cody / OpenCtx / Code Graph

- **Code Graph（Cody docs）**：基于定义/引用/符号等 **semantic code graph data**（indexer 产出，上传 Sourcegraph）；用于上下文，而非「随便当文本」。
- **OpenCtx**：把外部工具上下文以 `@` mention 形式注入；Cody 文档表列出 VS Code 等对 OpenCtx 的支持差异。
- **Agentic context**：可拉 MCP、OpenCtx、终端等；MCP **默认关**，Enterprise feature flag；**仅 Tools**，且文档写目前仅 **local MCP servers**。
- **限制**：强依赖 Sourcegraph 部署；**不是**给 Next.js monorepo 开箱即用的本地 JSON registry。
- **来源**：https://sourcegraph.com/docs/cody/core-concepts/code-graph 、https://sourcegraph.com/docs/cody/core-concepts/context 、https://sourcegraph.com/docs/cody/capabilities/agentic-context-fetching

#### Repo packing：Repomix、code2prompt

- **Repomix**：整库打成 AI 友好单文件（XML/MD/JSON 等）；官方提供 **`--mcp`**（文档标 **experimental**），工具含 `pack_codebase`、`grep_repomix_output` 等。
- **code2prompt**：目录遍历 + Handlebars 模板 + token 计数（README）。
- **限制**：解决的是 **上下文装填**，不是结构化「已有 Button 在哪」的查询 API；大库必截断。
- **来源**：https://github.com/yamadashy/repomix 、https://repomix.com/guide 、https://repomix.com/guide/mcp-server 、https://github.com/mufeedvh/code2prompt

#### LSP 作为 agent 能力面

- **官方**：LSP 标准化编辑器 ↔ language server（补全、定义、引用、诊断等）；TS 生态经 language service / tsserver。
- **限制**：一手规范面向 **IDE 客户端**；「agent 原生 LSP 工具」无统一产品标准。Cursor/Claude 通常封装为内部工具，而非暴露原始 LSP JSON-RPC 给用户规则。
- **映射**：scanner 可复用与 language service 相同的 Program/Checker；长期可把 `textDocument/definition` 类能力做成 MCP tool——**属自建，非现成产品**。
- **来源**：https://microsoft.github.io/language-server-protocol/ 、https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/

---

### 3.3 Knowledge storage & graphs（C）

#### JSON/YAML registries

- **是什么**：版本控制的结构化清单（组件名、路径、props 摘要、标签、owner）。
- **为何常用**：人可读、diff 友好、CI 易校验、MCP 易 `search*`；与 git 同源。
- **限制**：关系查询弱（「谁依赖谁」需自建边或多次扫描）；大文件需分片与索引。
- **映射**：用户方案 `.ai/knowledge/*.json` 与业界惯例一致——**推荐 day-1**。

#### SQLite / 本地 embeddings

- Continue 等工具用本地 embeddings 做 docs/codebase（部分旧文档描述）；Cursor 用云端向量索引（见上）。
- **何时向量 RAG 赢**：模糊「怎么做认证」类问题、文档散文。
- **何时结构化 registry 赢**：精确「是否已有 `PrimaryButton`」「`POST /api/projects` 是否存在」、去重门禁。
- **一手注意**：不要把 Cursor「semantic search 更好」外推成「不必做 registry」——Cursor 文档自己也建议改前先找既有模式。

#### Neo4j 与「代码知识图」产品

- **Neo4j 官方**：通用属性图（节点/关系/Cypher）；**未**声称内置「扫描 TSX 组件」的一等产品。
- **第三方**（降置信，非 Neo4j 第一方）：如社区 codegraph / ckg 等 README 宣称 tree-sitter → Neo4j → MCP。适合实验，**不宜**当作 open-ox 默认依赖。
- **映射**：关系爆炸（调用图、路由图）后再考虑图库；早期可用 JSON 里的 `dependsOn[]` / 邻接表。

#### Sourcegraph Code Graph vs GitHub Dependency graph（勿混）

| | Sourcegraph Cody Code Graph | GitHub Dependency graph |
|--|----------------------------|-------------------------|
| **粒度** | 符号/定义/引用等代码语义 | **包/manifest** 依赖 |
| **用途** | AI 上下文 / 精确导航 | 供应链、漏洞、SBOM |
| **Agent API** | 经 Cody/Sourcegraph 产品面 | Insights / Dependabot 等；**不是** `searchComponent` |

- **来源**：Cody Code Graph 文档（上）；https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph

---

### 3.4 Agent tooling interfaces（D）

#### Model Context Protocol（MCP）

- **是什么**：Host / Client / Server；JSON-RPC；Server 可暴露 **Tools / Resources / Prompts**。
- **Tools**：`tools/list`、`tools/call`；工具有 `name`、`description`、`inputSchema`（JSON Schema），可选 `outputSchema` / annotations。
- **映射**：`searchComponent` / `searchAPI` / `syncKnowledge` 正是典型 **Tools**；registry JSON 也可作 **Resources**。
- **来源**：https://modelcontextprotocol.io/specification/2025-11-25 、https://modelcontextprotocol.io/specification/2025-11-25/server/tools 、https://modelcontextprotocol.io/docs/learn/server-concepts

#### 已存在的 MCP servers（仅列可引一手 README 者）

| Server | 官方能力 | 是否等于 Project Intelligence |
|--------|----------|-------------------------------|
| **Filesystem**（reference） | 受限目录内读写/搜索文件 | 否——原始文件，非组件语义 |
| **GitHub**（`github/github-mcp-server`） | Issues/PR/仓库/代码等平台操作 | 否——GitHub 平台，非本地 AST registry |
| **Repomix `--mcp`** | 打包/检索打包输出 | 部分——整库上下文，非结构化 registry |
| **Git**（reference 仓库提及） | git 操作 | 否 |

- 旧 `modelcontextprotocol/servers` 内 GitHub 实现已指向 **archived**；当前应以 **github/github-mcp-server** 为准。
- **来源**：https://github.com/modelcontextprotocol/servers 、https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem 、https://github.com/github/github-mcp-server 、https://repomix.com/guide/mcp-server

#### Cursor Skills / Rules / Hooks（强制「先搜再造」）

- **Rules / AGENTS.md**：持久指令（软）。
- **Skills**：可编码「Reuse checklist」工作流（中）。
- **Hooks**：`preToolUse` / `beforeShellExecution` 等可 **拒绝** 操作（硬）——与 Claude Code「要用 hook 才能真正 block」同构。
- **来源**：Cursor Rules / Skills / Hooks 文档（§3.2）

#### open-ox 已有起点

| 资产 | 作用 |
|------|------|
| `AGENTS.md` | Skills、triage、domain、Next.js agent rules 指针 |
| `.agents/skills/` | 24+ skills：规划链、`code-review`、`domain-modeling`、`tdd`… |
| `CONTEXT.md` + `docs/adr/` | 术语与架构决策的人机可读知识 |
| `docs/claude-code/` | Claude 记忆机制逆向/对照笔记 |

→ **尚缺**：代码生成的 component/API JSON registry、sync CLI、registry MCP、reuse ESLint 规则。这些是产品层，不是 Cursor 内置功能。

---

### 3.5 DSL / schema-driven generation（E）

#### Schema → code（一手）

| 技术 | 能力 | 与 Code First 关系 |
|------|------|-------------------|
| **Prisma** | `schema.prisma` → `prisma generate` Client 等 | DSL 是数据模型真相源；**反向**从 DB  introspect 也有，但组件 UI 不在此列 |
| **GraphQL Code Generator** | Schema + documents → 类型/ hooks / resolvers 类型 | API 契约在 GraphQL SDL |
| **Amplify Gen2** | TypeScript `a.model()` 等定义数据 → 生成后端与类型（官方 Amplify Data 文档） | 云后端 DSL；不是通用 React 组件 registry |
| **Winglang** | 云基础设施 + 运行时统一语言（README） | 与 open-ox Studio UI builder **弱相关** |

- **来源**：https://www.prisma.io/docs/orm/prisma-schema/overview/generators 、https://www.prisma.io/docs/cli/generate 、https://the-guild.dev/graphql/codegen/docs/getting-started 、https://docs.amplify.aws/react/build-a-backend/data/set-up-data/ 、https://github.com/winglang/wing

#### 双路径澄清（对用户方案）

```text
Code First（知识同步）          DSL First（构建器生成）
源码 / route / Zod / JSX   →   registry / OpenAPI
        ↑ sync                         ↓ generate
   人改代码 / agent 改代码         schema / DSL 为真相源
```

- **知识层**应对 **已存在代码** 负责：扫描、diff、告警漂移。
- **DSL 层**适合 **新项目脚手架** 或数据模型：生成后代码再进入 Code First 扫描闭环。
- 二者可并存；**不要**假设「只用 DSL」能覆盖历史 Next.js App Router 手写路由。

---

### 3.6 Enforcement / review（F）

| 机制 | 一手/仓库事实 | 强度 |
|------|---------------|------|
| **ESLint + CI** | typescript-eslint 自定义规则；失败阻断合并 | 硬（对提交） |
| **CodeQL / 静态分析 CI** | GitHub code scanning | 硬（偏安全/模式） |
| **Agent rules / skills** | Cursor / Claude 文档：context 非强制 | 软 |
| **Hooks** | Cursor / Claude PreToolUse：可 block | 硬（对 agent 动作） |
| **Review agent prompts** | 本仓库 `code-review` skill：可要求对照 registry | 软–中 |
| **ADR + CONTEXT.md** | `docs/agents/domain.md`：探索前读术语与决策 | 软；积累架构知识（P3） |

**务实组合**：Registry MCP（发现）+ Rules/Skills（流程）+ ESLint（不可违反的导入边界）+ CI sync 校验（registry 与代码一致）+ 可选 Hooks（拦未查询写操作）。

---

## 4. 对用户方案的对照

| 用户构件 | 今日可落地技术 | Buildable now vs R&D |
|----------|----------------|----------------------|
| `.ai/knowledge/components.json` 等 | ts-morph/TS API 扫描导出 + JSON Schema 校验 | **Buildable** |
| `.ai/knowledge/apis.json` / OpenAPI | 路由扫描 + Zod `toJSONSchema` / zod-openapi / next-openapi-gen | **Buildable**（约定要先定） |
| Entity registry | Zod / Prisma schema 导出 | **Buildable** |
| `pnpm ai:sync` | Node CLI：扫描 → 写 JSON → git diff / `--check` CI | **Buildable** |
| MCP `searchComponent` / `searchAPI` | 自建 MCP server 读 JSON（规范成熟） | **Buildable** |
| Knowledge graph（Neo4j） | 可选；早期用 JSON 边 | **Postpone** 除非关系查询成为瓶颈 |
| Plan/Reuse/Review agents | Skills + Rules + code-review；Hooks 加强制 | **Buildable**（行为服从率需迭代） |
| DSL-first builder | Prisma/Amplify/自研 schema → codegen | **Partial**；与现有 Studio 手写流集成是产品设计，非缺库 |
| 「Cursor 自动懂全架构」 | Semantic search + AGENTS.md | **Partial**——无持久能力目录 API |

**结论**：用户愿景的主干（scanner + registry + MCP + rules + sync）与 **2026 年公开技术栈对齐**；缺口主要在 **约定与工程**（扫什么、ID 稳定性、生成项目 vs 平台 monorepo），不在「缺一个神秘框架」。

---

## 5. 推荐组合（务实路径）

### 路径 A — Day-0 / 最小可行（推荐 open-ox 先做）

1. **ts-morph（或 TS Compiler API）scanner** → `components.json` / `apis.json`（及可选 `entities.json`）
2. **Zod → JSON Schema** 挂到 API/Entity 条目
3. **MCP tools**：`searchComponent`、`searchAPI`、`listCapabilities`（读 registry）
4. **AGENTS.md / Skill**：「创建 UI/API 前必须调用 search*；禁止平行实现」
5. **CI**：`ai:sync --check`（漂移失败）
6. 依赖 Cursor/Claude **自带检索** 作补充，不替代 registry

**Tradeoff**：关系查询弱；scanner 启发式要维护（「何谓组件」）。

### 路径 B — 强化执行（人机协作）

在 A 之上：

- **typescript-eslint** 规则：禁止绕过 design-system 路径；禁止未登记路由模式（能静态判定的部分）
- **Cursor Hooks** / Claude **PreToolUse**：对匹配 `**/components/**` 的写入，要求近期有 registry 查询证据（启发式；需自研）
- **code-review skill** 增加 Spec 轴：对照 `.ai/knowledge`

**Tradeoff**：钩子误杀；规则过严影响原型速度。

### 路径 C — 规模化 / 可选（勿 day-1）

- Aider 式 **依赖图 ranking** 生成「会话用地图」缓存
- 调用图入 **SQLite 或 Neo4j**
- CodeQL 周期性重复模式审计
- Sourcegraph（若组织已有）作企业检索，仍保留本地 JSON 为 agent 契约

**Tradeoff**：运维与心智负担显著上升；对 open-ox **单仓 TypeScript** 收益可能小于成本。

### 明确不推荐作为第一步

- 用 **GitHub Dependency graph** 当组件知识图（粒度错误）
- 仅靠 **Repomix 整库打包** 当 registry（无结构化查询）
- 仅靠 **CLAUDE.md / Memory** 列组件（不可靠、不可 CI）
- **Neo4j day-1**（无证据表明 open-ox 规模需要）

---

## 6. 未证实 / 需谨慎

| 说法 | 判定 | 说明 |
|------|------|------|
| 「Cursor @codebase 等于项目知识库产品」 | 降级 | 一手是语义检索+工具编排，无导出 registry API |
| 「Sourcegraph Code Graph = 可自托管的 agent 组件目录」 | 降级 | 需 Sourcegraph indexer/实例；面向 Cody 上下文 |
| 「OpenCtx 已统一替代 MCP」 | 谨慎 | Cody 同时谈 OpenCtx 与 MCP；MCP 为跨宿主开放协议，OpenCtx 叙事偏 Sourcegraph 生态 |
| 「Next.js 官方自动 OpenAPI」 | 未证实 | 未见 Next.js 官方一等 codegen；依赖第三方/注释 |
| 「社区 Neo4j codegraph 开箱生产」 | 降级为实验 | 第三方 README，非 Neo4j/Microsoft/Vercel 第一方 |
| 「Hooks 可 100% 阻止重复组件」 | 未证实 | 可 block 工具；无法证明模型总走工具路径或证据不可伪造 |
| 「Vector RAG 单独解决去重」 | 谨慎 | 模糊召回 ≠ 精确存在性；需结构化 ID |

---

## 7. Sources

### 规范与官方文档

- TypeScript Compiler API：https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- ts-morph：https://github.com/dsherret/ts-morph 、https://ts-morph.com/
- tree-sitter：https://github.com/tree-sitter/tree-sitter 、https://tree-sitter.github.io 、https://github.com/tree-sitter/tree-sitter-typescript
- typescript-eslint Custom Rules：https://typescript-eslint.io/developers/custom-rules
- ESLint Custom Rules：https://eslint.org/docs/latest/extend/custom-rules
- CodeQL：https://codeql.github.com/docs/codeql-overview/about-codeql/ 、https://github.com/github/codeql
- Zod JSON Schema：https://zod.dev/json-schema
- zod-openapi：https://github.com/samchungy/zod-openapi
- next-swagger-doc：https://github.com/jellydn/next-swagger-doc
- next-openapi-gen：https://github.com/tazo90/next-openapi-gen
- tsoa-next：https://github.com/tsoa-next/tsoa-next
- MCP Spec / Tools：https://modelcontextprotocol.io/specification/2025-11-25 、https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP servers（reference）：https://github.com/modelcontextprotocol/servers
- Filesystem MCP：https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- GitHub MCP Server：https://github.com/github/github-mcp-server
- Cursor Search：https://cursor.com/docs/agent/tools/search
- Cursor Rules / Skills / Hooks：https://cursor.com/docs/rules 、https://cursor.com/docs/skills 、https://cursor.com/docs/hooks
- AGENTS.md 公约：https://agents.md/
- Claude Code Memory：https://code.claude.com/docs/en/memory
- Aider Repo map：https://aider.chat/docs/repomap.html
- Continue Context Providers：https://docs.continue.dev/customize/deep-dives/custom-providers
- Sourcegraph Cody Code Graph / Context / Agentic：https://sourcegraph.com/docs/cody/core-concepts/code-graph 、https://sourcegraph.com/docs/cody/core-concepts/context 、https://sourcegraph.com/docs/cody/capabilities/agentic-context-fetching
- Repomix：https://repomix.com/guide 、https://repomix.com/guide/mcp-server 、https://github.com/yamadashy/repomix
- code2prompt：https://github.com/mufeedvh/code2prompt
- LSP：https://microsoft.github.io/language-server-protocol/ 、https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/
- Neo4j：https://neo4j.com/docs/getting-started/graph-database/
- GitHub Dependency graph：https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph
- Prisma generators / generate：https://www.prisma.io/docs/orm/prisma-schema/overview/generators 、https://www.prisma.io/docs/cli/generate
- GraphQL Code Generator：https://the-guild.dev/graphql/codegen/docs/getting-started
- Amplify Gen2 Data：https://docs.amplify.aws/react/build-a-backend/data/set-up-data/
- Winglang：https://github.com/winglang/wing

### 本仓库一手材料

- `AGENTS.md`
- `.agents/skills/README.md`
- `docs/agents/domain.md`
- `CONTEXT.md`
- `docs/research/claude-memory-design-20260710.md`
- `docs/claude-code/06-memory-architecture.md`

---

## Confidence

| 区域 | 置信度 | 备注 |
|------|--------|------|
| Scanner（TS API / ts-morph / tree-sitter） | **高** | 官方文档清晰 |
| MCP 作为 search* 接口 | **高** | 规范明确；自建工作量可预期 |
| Cursor/Claude 检索与记忆 | **高**（能力边界） | 不足以替代结构化 registry——有官方表述支撑 |
| Next.js → OpenAPI 自动生成 | **中** | 依赖第三方；无 Next 官方一等方案 |
| Cody / OpenCtx 对本地 builder | **中低** | 产品绑定；MCP 限制写在官方 docs |
| Neo4j 代码 KG 第三方项目 | **低**（作生产默认） | 非图数据库厂商第一方「代码产品」 |
| Hooks 完全消除重复实现 | **低–中** | 机制存在；端到端有效性需实证 |

**总评**：用户「Code-first scanner + structured registry + MCP + rules/CI enforcement」路径与当前一手技术现实 **高度吻合**；应优先工程化 A→B，图数据库与企业 Code Graph 作可选升级。
